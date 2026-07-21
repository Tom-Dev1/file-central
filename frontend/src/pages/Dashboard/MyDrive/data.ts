import { File, FileArchive, FileImage, FileSpreadsheet, FileText, Folder } from "lucide-react";
import type { ComponentType } from "react";

type FileType = "folder" | "document" | "spreadsheet" | "image" | "archive" | "file";
export const fileIcons: Record<FileType, ComponentType<{ className?: string }>> = {
  folder: Folder,
  document: FileText,
  spreadsheet: FileSpreadsheet,
  image: FileImage,
  archive: FileArchive,
  file: File,
};

export interface DriveItem {
  id: string;
  name: string;
  type: FileType;
  owner: string;
  modifiedAt: string;
  size: string;
  shared?: boolean;
  starred?: boolean;
}

export const quickAccessItems: DriveItem[] = [
  {
    id: "quick-1",
    name: "Project Files",
    type: "folder",
    owner: "Me",
    modifiedAt: "Today",
    size: "—",
    shared: true,
  },
  {
    id: "quick-2",
    name: "Product Roadmap.docx",
    type: "document",
    owner: "Me",
    modifiedAt: "Yesterday",
    size: "2.4 MB",
  },
  {
    id: "quick-3",
    name: "Team Budget.xlsx",
    type: "spreadsheet",
    owner: "Me",
    modifiedAt: "Jul 18, 2026",
    size: "1.8 MB",
    starred: true,
  },
  {
    id: "quick-4",
    name: "Brand Assets",
    type: "folder",
    owner: "Marketing Team",
    modifiedAt: "Jul 16, 2026",
    size: "—",
    shared: true,
  },
];

export const driveItems: DriveItem[] = [
  {
    id: "1",
    name: "Project Files",
    type: "folder",
    owner: "Me",
    modifiedAt: "Today, 10:24 AM",
    size: "—",
    shared: true,
  },
  {
    id: "2",
    name: "Design Resources",
    type: "folder",
    owner: "Me",
    modifiedAt: "Yesterday, 4:15 PM",
    size: "—",
  },
  {
    id: "3",
    name: "Product Roadmap.docx",
    type: "document",
    owner: "Me",
    modifiedAt: "Yesterday, 2:30 PM",
    size: "2.4 MB",
  },
  {
    id: "4",
    name: "Team Budget.xlsx",
    type: "spreadsheet",
    owner: "Me",
    modifiedAt: "Jul 18, 2026",
    size: "1.8 MB",
    starred: true,
  },
  {
    id: "5",
    name: "Dashboard Preview.png",
    type: "image",
    owner: "Sarah Wilson",
    modifiedAt: "Jul 17, 2026",
    size: "6.7 MB",
    shared: true,
  },
  {
    id: "6",
    name: "Source Code.zip",
    type: "archive",
    owner: "Me",
    modifiedAt: "Jul 15, 2026",
    size: "84.3 MB",
  },
  {
    id: "7",
    name: "Meeting Notes.txt",
    type: "file",
    owner: "Me",
    modifiedAt: "Jul 14, 2026",
    size: "18 KB",
  },
];
