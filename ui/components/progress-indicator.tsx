"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
let showProgressIndicatorInternal = false;
let operationInProgressInternal = false;
let setShowProgressIndicatorInternal: ((show: boolean) => void) | null = null;
let operationTextInternal = "";
let setOperationTextInternal: ((text: string) => void) | null = null;
let setOperationInProgressInternal: ((inProgress: boolean) => void) | null = null;
export const showProgressIndicator = (operationText: string = "") => {
  if (operationInProgressInternal) {
    console.log("Operation already in progress. Ignoring new request:", operationText);
    return false;
  }
  if (setOperationInProgressInternal) {
    setOperationInProgressInternal(true);
  }
  operationInProgressInternal = true;
  if (setShowProgressIndicatorInternal) {
    setShowProgressIndicatorInternal(true);
  }
  if (setOperationTextInternal) {
    setOperationTextInternal(operationText);
  }
  showProgressIndicatorInternal = true;
  operationTextInternal = operationText;
  const event = new CustomEvent('operation-status-change', { 
    detail: { isInProgress: true, operationText } 
  });
  window.dispatchEvent(event);
  return true;
};

export const hideProgressIndicator = () => {
  if (setOperationInProgressInternal) {
    setOperationInProgressInternal(false);
  }
  operationInProgressInternal = false;
  if (setShowProgressIndicatorInternal) {
    setShowProgressIndicatorInternal(false);
  }
  showProgressIndicatorInternal = false;
  const event = new CustomEvent('operation-status-change', { 
    detail: { isInProgress: false, operationText: "" } 
  });
  window.dispatchEvent(event);
};

export const isOperationInProgress = () => {
  return operationInProgressInternal;
};

export function ProgressIndicator({ className }: { className?: string }) {
  const [isMounted, setIsMounted] = useState(false);
  const [show, setShow] = useState(showProgressIndicatorInternal);
  const [operationText, setOperationText] = useState(operationTextInternal);
  const [operationInProgress, setOperationInProgress] = useState(operationInProgressInternal);
  useEffect(() => {
    setShowProgressIndicatorInternal = setShow;
    setOperationTextInternal = setOperationText;
    setOperationInProgressInternal = setOperationInProgress;
    return () => {
      setShowProgressIndicatorInternal = null;
      setOperationTextInternal = null;
      setOperationInProgressInternal = null;
    };
  }, []);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {

    const handleProgressStart = (event: CustomEvent) => {
  
      if (operationInProgress) {
        console.log("Operation already in progress. Ignoring event:", event);
        return;
      }
      
      const { operationText = "" } = event.detail || {};
      setOperationInProgress(true);
      setShow(true);
      setOperationText(operationText);
    };

    const handleProgressEnd = () => {
      setOperationInProgress(false);
      setShow(false);
    };

    window.addEventListener("progress-indicator-start", handleProgressStart as EventListener);
    window.addEventListener("progress-indicator-end", handleProgressEnd);

    return () => {
      window.removeEventListener("progress-indicator-start", handleProgressStart as EventListener);
      window.removeEventListener("progress-indicator-end", handleProgressEnd);
    };
  }, [operationInProgress]);

  if (!isMounted) return null;

  if (!show) return null;

  return (
    <div className={cn("absolute top-0 w-full z-50", className)}>
      <div className="progress-indicator-chat" />
      {operationText && (
        <div className="flex justify-center w-full mb-4">
          <div className="px-3 py-1 bg-green-300 dark:bg-green-900/30 my-2 text-green-800 dark:text-green-300 text-xs rounded-md shadow-md ">
            {operationText}
          </div>
        </div>
      )}
    </div>
  );
  
} 