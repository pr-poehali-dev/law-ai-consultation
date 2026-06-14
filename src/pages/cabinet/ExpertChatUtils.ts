import type { LawyerMessage, LawyerDialog } from "@/lib/auth";
import type { ChatMsg } from "./ChatTab";
import type { GenDoc } from "./DocsTab";
import type { Attachment, ContentAttachment, FileAttachment } from "./ExpertAttachPanel";

export const EXPERT_NAME = "Эксперт-юрист Поварчук И.В.";

export function fmtTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function parseFileLinks(body: string): { text: string; files: { name: string; url: string }[] } {
  const MARKER = "[Прикреплённые файлы]";
  const idx = body.indexOf(MARKER);
  if (idx === -1) return { text: body, files: [] };
  const text = body.slice(0, idx).trim();
  const filesSection = body.slice(idx + MARKER.length);
  const files: { name: string; url: string }[] = [];
  filesSection.split("\n").forEach(line => {
    const trimmed = line.trim();
    const match = trimmed.match(/^📎 (.+?): (https?:\/\/.+)$/);
    if (match) files.push({ name: match[1], url: match[2] });
  });
  return { text, files };
}

export interface ExpertChatProps {
  isAdmin: boolean;
  isFreeUser?: boolean;
  selectedUserId: number | null;
  currentDialog: LawyerDialog | null | undefined;
  lmsgs: LawyerMessage[];
  loading: boolean;
  input: string;
  sending: boolean;
  uploadProgress: number;
  err: string;
  attachments: Attachment[];
  showAttachPanel: boolean;
  viewFullMsg: { title: string; content: string; type: string; downloadUrl?: string } | null;
  aiAnswers: ChatMsg[];
  genDocs: GenDoc[];
  isBlocked?: boolean;
  lawyerQLeft?: number;
  currentPlanId?: string;
  onBack: () => void;
  onRefresh: () => void;
  onInputChange: (v: string) => void;
  onSend: () => void;
  onToggleAttachPanel: () => void;
  onHideAttachPanel: () => void;
  onAddAttachment: (att: ContentAttachment) => void;
  onAddFiles: (files: FileAttachment[]) => void;
  onRemoveAttachment: (i: number) => void;
  onViewFullMsg: (v: { title: string; content: string; type: string; downloadUrl?: string }) => void;
  onCloseFullMsg: () => void;
  onBuyLawyerQuestions?: () => void;
  onUpgradePlan?: () => void;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  bottomRef: React.RefObject<HTMLDivElement>;
  adjustTextarea: () => void;
}