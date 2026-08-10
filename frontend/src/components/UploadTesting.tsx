import { useCallback, useRef, useState } from "react";
import { Button, Card, Progress, Space, Tag, Typography, Input, Upload, Steps, Divider, message } from "antd";
import { InboxOutlined, CloudUploadOutlined, StopOutlined, ReloadOutlined } from "@ant-design/icons";
import { uploadApi } from "@/apis/upload.api";
import type { InitUploadResponse, CompletePart } from "@/types/upload.types";
import axios from "axios";
import classes from "./UploadTesting.module.css";

const { Dragger } = Upload;
const { Text, Paragraph } = Typography;

/**
 * Component test luồng upload cho File Central — dùng uploadApi (axios instance).
 *
 * Luồng: uploadApi.init -> uploadApi.putToStorage (thẳng MinIO) -> uploadApi.complete
 *   - single (< 8MB): 1 PUT
 *   - multipart (>= 8MB): PUT từng part song song, đọc ETag
 *   - mất mạng: uploadApi.status -> PUT lại part thiếu -> complete
 *
 * Panel "Flow log" in ra từng bước để thấy rõ luồng đi.
 */

const CONCURRENCY = 3; // số part upload song song
const SINGLE_PART_MAX_BYTES = 8 * 1024 * 1024; // khớp server

type LogKind = "info" | "api" | "minio" | "success" | "error";
interface LogEntry {
  time: string;
  kind: LogKind;
  text: string;
}
interface PartState {
  partNumber: number;
  status: "pending" | "uploading" | "done" | "error";
}

export default function UploadTester() {
  const [file, setFile] = useState<File | null>(null);
  const [parentId, setParentId] = useState<string>("");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [uploading, setUploading] = useState(false);
  const [overallProgress, setOverallProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [parts, setParts] = useState<PartState[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [multipartPartSize, setMultipartPartSize] = useState<number | null>(null);

  const abortedRef = useRef(false);
  const sessionRef = useRef<string | null>(null);

  const log = useCallback((kind: LogKind, text: string) => {
    const time = new Date().toLocaleTimeString("vi-VN", { hour12: false });
    setLogs((prev) => [...prev, { time, kind, text }]);
  }, []);

  const resetState = () => {
    setLogs([]);
    setOverallProgress(0);
    setCurrentStep(0);
    setParts([]);
    setSessionId(null);
    setMultipartPartSize(null);
    abortedRef.current = false;
    sessionRef.current = null;
  };

  // Upload nhiều part với giới hạn song song.
  const uploadPartsWithConcurrency = async (
    f: File,
    partSizeBytes: number,
    partUrls: { partNumber: number; url: string }[],
    onOne: (partNumber: number, etag: string, size: number) => void
  ) => {
    let index = 0;
    const total = partUrls.length;
    let completed = 0;

    const worker = async () => {
      while (index < partUrls.length) {
        if (abortedRef.current) throw new Error("ABORTED_BY_USER");
        const my = index++;
        const { partNumber, url } = partUrls[my];

        setParts((prev) => prev.map((p) => (p.partNumber === partNumber ? { ...p, status: "uploading" } : p)));

        const start = (partNumber - 1) * partSizeBytes;
        const chunk = f.slice(start, start + partSizeBytes); // Blob, không load cả file vào RAM
        log("minio", `PUT part ${partNumber} (${formatBytes(chunk.size)}) → MinIO`);

        const etag = await uploadApi.putToStorage(url, chunk);
        onOne(partNumber, etag, chunk.size);

        setParts((prev) => prev.map((p) => (p.partNumber === partNumber ? { ...p, status: "done" } : p)));
        completed++;
        setOverallProgress(Math.round((completed / total) * 100));
      }
    };

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, total) }, () => worker()));
  };

  // =============================================================
  // LUỒNG UPLOAD CHÍNH
  // =============================================================
  const startUpload = async () => {
    if (!file) {
      message.warning("Chọn file trước đã");
      return;
    }
    resetState();
    setUploading(true);

    try {
      // ---- 1. INIT ----
      setCurrentStep(0);
      log("info", `Bắt đầu upload "${file.name}" (${formatBytes(file.size)})`);
      log("api", `uploadApi.init { name, parentId=${parentId || "null"}, declaredSizeBytes=${file.size} }`);

      const init: InitUploadResponse = await uploadApi.init({
        name: file.name,
        parentId: parentId || null,
        declaredSizeBytes: String(file.size),
        idempotencyKey: crypto.randomUUID(),
      });

      setSessionId(init.uploadSessionId);
      setMultipartPartSize(init.method === "multipart" ? init.partSizeBytes : null);
      sessionRef.current = init.uploadSessionId;
      log("success", `Server chọn method="${init.method}", sessionId=${init.uploadSessionId}`);
      log("info", "→ File placeholder đã tạo trong folder (fileStatus=uploading)");

      const collected: CompletePart[] = [];

      // ---- 2. UPLOAD BYTE ----
      setCurrentStep(1);
      if (init.method === "single") {
        log("minio", `PUT toàn bộ file → MinIO (${formatBytes(file.size)})`);
        setParts([{ partNumber: 1, status: "uploading" }]);
        await uploadApi.putToStorage(init.putUrl, file, {
          contentType: file.type || "application/octet-stream",
          onProgress: (p) => setOverallProgress(p),
        });
        setParts([{ partNumber: 1, status: "done" }]);
        setOverallProgress(100);
        log("success", "Đã PUT xong file lên MinIO");
      } else {
        const { partSizeBytes, partUrls, expectedPartsCount } = init;
        log("info", `Multipart: ${expectedPartsCount} part, mỗi part ${formatBytes(partSizeBytes)}`);
        setParts(partUrls.map((p) => ({ partNumber: p.partNumber, status: "pending" as const })));

        await uploadPartsWithConcurrency(file, partSizeBytes, partUrls, (partNumber, etag, size) => {
          collected.push({ partNumber, etag, sizeBytes: String(size) });
        });
        log("success", `Đã upload ${collected.length} part`);
      }

      // ---- 3. COMPLETE ----
      setCurrentStep(2);
      log("api", `uploadApi.complete(${init.uploadSessionId})`);
      const result = await uploadApi.complete(init.uploadSessionId, {
        parts: init.method === "multipart" ? collected.sort((a, b) => a.partNumber - b.partNumber) : undefined,
      });

      setCurrentStep(3);
      log("success", `HOÀN TẤT! driveItemId=${result.driveItemId}, status=${result.status}`);
      log("info", "→ File chuyển fileStatus=active, sẵn sàng preview/download");
      message.success("Upload thành công");
    } catch (err: unknown) {
      handleError(err);
    } finally {
      setUploading(false);
    }
  };

  // =============================================================
  // RESUME
  // =============================================================
  const resumeUpload = async () => {
    const sid = sessionRef.current;
    if (!sid || !file) {
      message.warning("Chưa có session để resume");
      return;
    }
    setUploading(true);
    abortedRef.current = false;
    try {
      log("api", `uploadApi.status(${sid}) — hỏi server còn thiếu part nào`);
      const status = await uploadApi.status(sid);

      if (status.status === "completed") {
        log("success", "Session đã completed rồi");
        return;
      }

      const missing = status.missingPartUrls ?? [];
      log(
        "info",
        missing.length ? `Còn thiếu ${missing.length} part, upload tiếp...` : "Không còn part thiếu — thử complete"
      );

      const collected: CompletePart[] = (status.uploadedParts ?? []).map((p) => ({
        partNumber: p.partNumber,
        etag: p.etag,
        sizeBytes: p.sizeBytes,
      }));

      const partSize = multipartPartSize ?? (file.size > SINGLE_PART_MAX_BYTES ? SINGLE_PART_MAX_BYTES : file.size);

      for (const { partNumber, url } of missing) {
        if (abortedRef.current) throw new Error("ABORTED_BY_USER");
        const start = (partNumber - 1) * partSize;
        const chunk = file.slice(start, start + partSize);
        log("minio", `PUT lại part ${partNumber} → MinIO`);
        const etag = await uploadApi.putToStorage(url, chunk);
        collected.push({ partNumber, etag, sizeBytes: String(chunk.size) });
      }

      log("api", `uploadApi.complete(${sid})`);
      const result = await uploadApi.complete(sid, {
        parts: collected.sort((a, b) => a.partNumber - b.partNumber),
      });
      setCurrentStep(3);
      setOverallProgress(100);
      log("success", `RESUME HOÀN TẤT! driveItemId=${result.driveItemId}`);
      message.success("Resume thành công");
    } catch (err: unknown) {
      handleError(err);
    } finally {
      setUploading(false);
    }
  };

  // =============================================================
  // ABORT
  // =============================================================
  const abortUpload = async () => {
    abortedRef.current = true;
    const sid = sessionRef.current;
    if (sid) {
      try {
        log("api", `uploadApi.abort(${sid})`);
        await uploadApi.abort(sid);
        log("info", "Server đã huỷ session + release quota");
      } catch (err: unknown) {
        log("error", `Abort lỗi: ${err instanceof Error ? err.message : "Lỗi không xác định"}`);
      }
    }
    setUploading(false);
  };

  // Xử lý lỗi chung. axios lỗi -> err.response.data.{code,message}
  const handleError = (err: unknown) => {
    if (err instanceof Error && err.message === "ABORTED_BY_USER") {
      log("info", "Đã dừng theo yêu cầu người dùng");
      return;
    }
    const responseData = axios.isAxiosError<{ code?: string; message?: string }>(err) ? err.response?.data : undefined;
    const code = responseData?.code ?? (axios.isAxiosError(err) ? err.code : undefined);
    const msg = responseData?.message ?? (err instanceof Error ? err.message : "Lỗi không xác định");
    log("error", `Lỗi: ${code ? `[${code}] ` : ""}${msg}`);
    if (code === "QUOTA_EXCEEDED") message.error("Vượt dung lượng cho phép");
    else message.error(msg);
  };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>


      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>

        <div style={{ flex: "1 1 420px", minWidth: 380 }}>
          <Card size="small" title="1. Chọn file & folder đích">
            <Space direction="vertical" style={{ width: "100%" }}>
              <Input
                addonBefore="parentId"
                placeholder="để trống = root"
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
                disabled={uploading}
              />
              <Dragger
                multiple={false}
                beforeUpload={(f) => {
                  setFile(f);
                  return false;
                }}
                maxCount={1}
                disabled={uploading}
              >
                <p className={classes.dragIcon}>
                  <InboxOutlined />
                </p>
                <p className={classes.dragText}>Kéo thả hoặc bấm chọn file</p>
                <p className={classes.dragHint}>File &lt; 8MB → single; ≥ 8MB → multipart</p>
              </Dragger>
              {file && (
                <Text>
                  Đã chọn: <Text strong>{file.name}</Text> ({formatBytes(file.size)}){" "}
                  <Tag color={file.size >= SINGLE_PART_MAX_BYTES ? "blue" : "green"}>
                    {file.size >= SINGLE_PART_MAX_BYTES ? "multipart" : "single"}
                  </Tag>
                </Text>
              )}
            </Space>
          </Card>

          <Card size="small" title="2. Thao tác" style={{ marginTop: 16 }}>
            <Space wrap>
              <Button
                type="primary"
                icon={<CloudUploadOutlined />}
                onClick={startUpload}
                loading={uploading}
                disabled={!file}
              >
                Bắt đầu upload
              </Button>
              <Button icon={<StopOutlined />} danger onClick={abortUpload} disabled={!sessionId}>
                Huỷ (abort)
              </Button>
              <Button icon={<ReloadOutlined />} onClick={resumeUpload} disabled={!sessionId || uploading}>
                Resume
              </Button>
            </Space>
            <Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0, fontSize: 12 }}>
              Test resume: upload file lớn, tắt mạng (DevTools → Offline) giữa chừng, bật lại rồi bấm "Resume".
            </Paragraph>
          </Card>

          <Card size="small" title="3. Tiến trình" style={{ marginTop: 16 }}>
            <Steps
              size="small"
              current={currentStep}
              status={currentStep >= 3 ? "finish" : "process"}
              items={[{ title: "Init" }, { title: "Upload byte" }, { title: "Complete" }]}
            />
            <Progress percent={overallProgress} style={{ marginTop: 16 }} />
            {parts.length > 1 && (
              <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 4 }}>
                {parts.map((p) => (
                  <Tag
                    key={p.partNumber}
                    color={
                      p.status === "done"
                        ? "green"
                        : p.status === "uploading"
                          ? "blue"
                          : p.status === "error"
                            ? "red"
                            : "default"
                    }
                    style={{ margin: 0 }}
                  >
                    {p.partNumber}
                  </Tag>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Cột phải: flow log */}
        <div style={{ flex: "1 1 420px", minWidth: 380 }}>
          <Card
            size="small"
            title="Flow log — luồng gọi API"
            extra={
              <Button size="small" onClick={() => setLogs([])}>
                Clear
              </Button>
            }
            styles={{ body: { padding: 0 } }}
          >
            <div
              style={{
                height: 520,
                overflowY: "auto",
                fontFamily: "monospace",
                fontSize: 12,
                padding: 12,
                background: "#0b0b0b",
                color: "#ddd",
                borderRadius: 4,
              }}
            >
              {logs.length === 0 && (
                <Text type="secondary" style={{ color: "#666" }}>
                  Chưa có log. Bấm "Bắt đầu upload".
                </Text>
              )}
              {logs.map((l, i) => (
                <div key={i} style={{ marginBottom: 4, lineHeight: 1.5 }}>
                  <span style={{ color: "#555" }}>{l.time} </span>
                  <span style={{ color: kindColor(l.kind) }}>{kindLabel(l.kind)}</span> <span>{l.text}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card size="small" title="Chú thích luồng" style={{ marginTop: 16 }}>
            <Space direction="vertical" size={2}>
              <Text style={{ fontSize: 12 }}>
                <Tag color="purple">API</Tag> gọi backend NestJS (qua axios instance `api`)
              </Text>
              <Text style={{ fontSize: 12 }}>
                <Tag color="orange">MinIO</Tag> PUT byte thẳng lên storage (axios trần, không interceptor)
              </Text>
              <Text style={{ fontSize: 12 }}>
                <Tag color="green">OK</Tag> bước thành công
              </Text>
            </Space>
            <Divider style={{ margin: "12px 0" }} />
            <Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 0 }}>
              Byte KHÔNG qua NestJS. Backend chỉ cấp presigned URL + quản lý metadata.
            </Paragraph>
          </Card>
        </div>
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

function kindColor(kind: LogKind): string {
  switch (kind) {
    case "api":
      return "#b37feb";
    case "minio":
      return "#ffa940";
    case "success":
      return "#73d13d";
    case "error":
      return "#ff4d4f";
    default:
      return "#8c8c8c";
  }
}

function kindLabel(kind: LogKind): string {
  switch (kind) {
    case "api":
      return "[API] ";
    case "minio":
      return "[MinIO]";
    case "success":
      return "[OK]  ";
    case "error":
      return "[ERR] ";
    default:
      return "[..]  ";
  }
}
