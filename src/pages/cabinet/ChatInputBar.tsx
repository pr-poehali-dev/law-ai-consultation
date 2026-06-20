import { useRef, useEffect, useState, useCallback } from "react";
import type { User } from "@/lib/auth";
import ChatInputDragOverlay from "./ChatInputDragOverlay";
import ChatInputFileList from "./ChatInputFileList";
import ChatInputQuickActions from "./ChatInputQuickActions";
import ChatInputField from "./ChatInputField";

interface ChatInputBarProps {
  user: User;
  input: string;
  typing: boolean;
  fileUploading: boolean;
  totalLeft: number;
  canUploadFiles?: boolean;
  onUpgradeClick?: () => void;
  attachedFiles: { name: string; b64: string; size: string }[];
  fileInputRef: React.RefObject<HTMLInputElement>;
  onInputChange: (v: string) => void;
  onSend: (text?: string) => void;
  onSendFile: (comment: string) => void;
  onAttachClick: () => void;
  onRemoveFile: (idx: number) => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onFileDrop?: (files: FileList) => void;
  onQuickAction?: (text: string) => void;
  onSosClick?: () => void;
  onFilesFromConverter?: (files: { name: string; b64: string; size: string }[]) => void;
}

const MAX_FILES = 3;

export default function ChatInputBar({
  user,
  input,
  typing,
  fileUploading,
  totalLeft,
  canUploadFiles = false,
  onUpgradeClick,
  attachedFiles,
  fileInputRef,
  onInputChange,
  onSend,
  onSendFile,
  onAttachClick,
  onRemoveFile,
  onFileSelect,
  onFileDrop,
  onQuickAction,
  onSosClick,
  onFilesFromConverter,
}: ChatInputBarProps) {
  const nativeInputRef = useRef<HTMLTextAreaElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showToolsSheet, setShowToolsSheet] = useState(false);
  const [showConverter, setShowConverter] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const dragCounterRef = useRef(0);

  useEffect(() => {
    const el = nativeInputRef.current;
    if (!el) return;
    if (el !== document.activeElement && el.value !== input) {
      el.value = input;
    }
  }, [input]);

  useEffect(() => {
    if (input === "" && nativeInputRef.current) {
      nativeInputRef.current.value = "";
      nativeInputRef.current.style.height = "44px";
    }
  }, [input]);

  const handleSend = () => {
    const nativeVal = nativeInputRef.current?.value ?? "";
    const comment = nativeVal.trim() || input.trim();

    if (!comment && !attachedFiles.length) return;

    if (attachedFiles.length) {
      if (nativeInputRef.current) {
        nativeInputRef.current.value = "";
        nativeInputRef.current.style.height = "44px";
      }
      onInputChange("");
      onSendFile(comment);
    } else {
      if (nativeVal.trim()) onInputChange(nativeVal);
      onSend();
    }
  };

  const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    onInputChange(el.value);
    el.style.height = "44px";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  };

  // ── Drag-and-drop ─────────────────────────────────────────────────────
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (canUploadFiles && e.dataTransfer.types.includes("Files")) {
      setIsDragging(true);
    }
  }, [canUploadFiles]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragging(false);

    if (!canUploadFiles) {
      onUpgradeClick?.();
      return;
    }
    const files = e.dataTransfer.files;
    if (files && files.length > 0 && onFileDrop) {
      onFileDrop(files);
    }
  }, [canUploadFiles, onFileDrop, onUpgradeClick]);

  const hasFiles = attachedFiles.length > 0;
  const canAddMore = attachedFiles.length < MAX_FILES;

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className="relative"
    >
      <ChatInputDragOverlay isDragging={isDragging} />

      {hasFiles && (
        <ChatInputFileList
          attachedFiles={attachedFiles}
          typing={typing}
          fileUploading={fileUploading}
          onAttachClick={onAttachClick}
          onRemoveFile={onRemoveFile}
        />
      )}

      {!hasFiles && (
        <ChatInputQuickActions
          typing={typing}
          showToolsSheet={showToolsSheet}
          onToggleToolsSheet={setShowToolsSheet}
          onQuickAction={onQuickAction}
        />
      )}

      <ChatInputField
        user={user}
        input={input}
        typing={typing}
        fileUploading={fileUploading}
        totalLeft={totalLeft}
        canUploadFiles={canUploadFiles}
        hasFiles={hasFiles}
        canAddMore={canAddMore}
        attachedFilesCount={attachedFiles.length}
        showAttachMenu={showAttachMenu}
        showConverter={showConverter}
        fileInputRef={fileInputRef}
        nativeInputRef={nativeInputRef}
        onUpgradeClick={onUpgradeClick}
        onAttachClick={onAttachClick}
        onFileSelect={onFileSelect}
        onFilesFromConverter={onFilesFromConverter}
        onSosClick={onSosClick}
        onHandleSend={handleSend}
        onHandleInput={handleInput}
        onToggleAttachMenu={setShowAttachMenu}
        onToggleConverter={setShowConverter}
      />
    </div>
  );
}
