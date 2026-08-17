import { useState } from "react";
import {
  CheckCircleFilled,
  CloseCircleFilled,
  CloseOutlined,
  DownOutlined,
  FileOutlined,
  FolderOutlined,
  RedoOutlined,
  UpOutlined,
} from "@ant-design/icons";
import { Button, Progress, Tooltip } from "antd";

import { useUploadManager } from "@/hooks/useUploadManager";
import classes from "./UploadProgressPanel.module.css";

export function UploadProgressPanel() {
  const [collapsed, setCollapsed] = useState(false);
  const { tasks, cancel, retry, dismiss, clearFinished } = useUploadManager();

  if (tasks.length === 0) return null;

  const activeCount = tasks.filter((task) => task.status === "queued" || task.status === "uploading").length;

  return (
    <section className={classes.panel} aria-label="Upload progress" aria-live="polite">
      <div className={classes.header}>
        <div>
          <div className={classes.title}>{activeCount > 0 ? `Uploading ${activeCount} item${activeCount > 1 ? "s" : ""}` : "Uploads"}</div>
          {activeCount === 0 && <div className={classes.headerDetail}>All uploads finished</div>}
        </div>
        <div className={classes.headerActions}>
          <Tooltip title={collapsed ? "Show uploads" : "Hide uploads"}>
            <Button
              type="text"
              size="small"
              className={classes.headerButton}
              aria-label={collapsed ? "Show uploads" : "Hide uploads"}
              icon={collapsed ? <UpOutlined /> : <DownOutlined />}
              onClick={() => setCollapsed((value) => !value)}
            />
          </Tooltip>
          <Tooltip title={activeCount > 0 ? "Clear finished uploads" : "Close"}>
            <Button
              type="text"
              size="small"
              className={classes.headerButton}
              aria-label={activeCount > 0 ? "Clear finished uploads" : "Close upload panel"}
              icon={<CloseOutlined />}
              onClick={clearFinished}
            />
          </Tooltip>
        </div>
      </div>

      {!collapsed && (
        <div className={classes.taskList}>
          {tasks.map((task) => {
            const isActive = task.status === "queued" || task.status === "uploading";
            const canRetry = task.kind === "file" && (task.status === "error" || task.status === "cancelled");

            return (
              <div key={task.id} className={classes.task}>
                <div className={classes.kindIcon} aria-hidden="true">
                  {task.kind === "folder" ? <FolderOutlined /> : <FileOutlined />}
                </div>

                <div className={classes.taskBody}>
                  <div className={classes.taskTopLine}>
                    <Tooltip title={task.name}>
                      <span className={classes.taskName}>{task.name}</span>
                    </Tooltip>
                    {task.status === "completed" && <CheckCircleFilled className={classes.successIcon} />}
                    {task.status === "error" && <CloseCircleFilled className={classes.errorIcon} />}
                  </div>
                  <div className={classes.detail}>{task.detail}</div>
                  {(isActive || task.status === "error") && (
                    <Progress
                      percent={task.percent}
                      status={task.status === "error" ? "exception" : "active"}
                      showInfo={false}
                      size="small"
                      className={classes.progress}
                    />
                  )}
                </div>

                <div className={classes.taskActions}>
                  {isActive && (
                    <Tooltip title="Cancel upload">
                      <Button
                        type="text"
                        size="small"
                        aria-label={`Cancel upload ${task.name}`}
                        icon={<CloseOutlined />}
                        onClick={() => cancel(task.id)}
                      />
                    </Tooltip>
                  )}
                  {canRetry && (
                    <Tooltip title="Retry upload">
                      <Button
                        type="text"
                        size="small"
                        aria-label={`Retry upload ${task.name}`}
                        icon={<RedoOutlined />}
                        onClick={() => retry(task.id)}
                      />
                    </Tooltip>
                  )}
                  {!isActive && (
                    <Tooltip title="Remove from list">
                      <Button
                        type="text"
                        size="small"
                        aria-label={`Remove upload ${task.name}`}
                        icon={<CloseOutlined />}
                        onClick={() => dismiss(task.id)}
                      />
                    </Tooltip>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
