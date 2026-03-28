"use client";

import React, { useState } from "react";
import {
  Upload,
  Play,
  Pause,
  RotateCcw,
  AlertCircle,
  CheckCircle,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

interface ProcessingError {
  id: string;
  file: string;
  error: string;
  timestamp: string;
}

export interface BatchProcessorProps {
  onProcess?: (filename: string) => void;
}

export function BatchProcessor({ onProcess }: BatchProcessorProps) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [processedItems, setProcessedItems] = useState(0);
  const [errors, setErrors] = useState<ProcessingError[]>([]);
  const [showErrors, setShowErrors] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file.name);
      setTotalItems(Math.floor(Math.random() * 500) + 50);
      setProcessedItems(0);
      setProgress(0);
      setErrors([]);
      toast.success(`File selected: ${file.name}`);
    }
  };

  const handleStart = async () => {
    if (!selectedFile) {
      toast.error("Please select a file first");
      return;
    }

    setIsProcessing(true);
    setIsPaused(false);
    onProcess?.(selectedFile);

    // Simulate batch processing
    let currentProgress = 0;
    const interval = setInterval(() => {
      if (!isPaused && currentProgress < 100) {
        currentProgress += Math.random() * 15;
        setProgress(Math.min(currentProgress, 100));
        setProcessedItems(Math.floor((totalItems * currentProgress) / 100));

        // Randomly add some errors
        if (Math.random() < 0.05 && currentProgress < 90) {
          const newError: ProcessingError = {
            id: `err${Date.now()}`,
            file: `item_${processedItems}.csv`,
            error: "Invalid data format in column B",
            timestamp: new Date().toLocaleTimeString(),
          };
          setErrors((prev) => [...prev, newError]);
        }
      }

      if (currentProgress >= 100) {
        clearInterval(interval);
        setIsProcessing(false);
        setProgress(100);
        toast.success("Batch processing completed!");
      }
    }, 500);
  };

  const handlePause = () => {
    setIsPaused(!isPaused);
    toast.success(isPaused ? "Processing resumed" : "Processing paused");
  };

  const handleCancel = () => {
    setIsProcessing(false);
    setIsPaused(false);
    setProgress(0);
    setProcessedItems(0);
    setSelectedFile(null);
    setErrors([]);
    toast.info("Batch processing cancelled");
  };

  const handleClearErrors = () => {
    setErrors([]);
    setShowErrors(false);
  };

  return (
    <div className="w-full space-y-6">
      {/* File Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Select File for Processing</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-center">
            <label className="relative cursor-pointer flex-1">
              <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-6 hover:border-blue-400 dark:hover:border-blue-600 transition-colors text-center">
                <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {selectedFile ? selectedFile : "Click to select a file"}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  CSV, JSON, or XLSX formats supported
                </p>
              </div>
              <input
                type="file"
                accept=".csv,.json,.xlsx"
                onChange={handleFileSelect}
                className="hidden"
                disabled={isProcessing}
              />
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Progress Section */}
      {selectedFile && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Processing Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Progress Bar */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Progress: {progress.toFixed(0)}%
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {processedItems} / {totalItems} items
                </p>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-blue-600 h-full rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Status */}
            <div className="flex items-center gap-2">
              {isProcessing && (
                <>
                  <Clock className="h-4 w-4 text-blue-600" />
                  <span className="text-sm text-blue-600 dark:text-blue-400">
                    {isPaused ? "Paused" : "Processing..."}
                  </span>
                </>
              )}
              {!isProcessing && progress === 100 && (
                <>
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-green-600 dark:text-green-400">
                    Completed
                  </span>
                </>
              )}
              {!isProcessing && progress === 0 && selectedFile && (
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Ready to process
                </span>
              )}
            </div>

            {/* Control Buttons */}
            <div className="flex gap-2">
              {!isProcessing && progress < 100 && (
                <Button
                  onClick={handleStart}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Start Processing
                </Button>
              )}

              {isProcessing && (
                <>
                  <Button onClick={handlePause} variant="outline">
                    {isPaused ? (
                      <>
                        <Play className="h-4 w-4 mr-2" />
                        Resume
                      </>
                    ) : (
                      <>
                        <Pause className="h-4 w-4 mr-2" />
                        Pause
                      </>
                    )}
                  </Button>
                  <Button onClick={handleCancel} variant="outline">
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                </>
              )}

              {progress > 0 && !isProcessing && (
                <Button onClick={handleCancel} variant="outline">
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Log Panel */}
      {errors.length > 0 && (
        <Card className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <CardTitle className="text-lg">
                  Errors ({errors.length})
                </CardTitle>
              </div>
              <Button
                onClick={() => setShowErrors(!showErrors)}
                variant="ghost"
                size="sm"
              >
                {showErrors ? "Hide" : "Show"}
              </Button>
            </div>
          </CardHeader>

          {showErrors && (
            <CardContent className="space-y-2 border-t border-red-200 dark:border-red-800 pt-4">
              <div className="max-h-48 overflow-y-auto space-y-2">
                {errors.map((error) => (
                  <div
                    key={error.id}
                    className="bg-white dark:bg-gray-800 rounded p-3 text-sm border border-red-100 dark:border-red-900"
                  >
                    <p className="font-medium text-gray-900 dark:text-white">
                      {error.file}
                    </p>
                    <p className="text-red-600 dark:text-red-400 text-xs mt-1">
                      {error.error}
                    </p>
                    <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">
                      {error.timestamp}
                    </p>
                  </div>
                ))}
              </div>

              <Button
                onClick={handleClearErrors}
                variant="outline"
                size="sm"
                className="w-full mt-2"
              >
                Clear Errors
              </Button>
            </CardContent>
          )}
        </Card>
      )}

      {/* Stats Summary */}
      {selectedFile && (
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {totalItems}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Total Items
                </p>
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {processedItems}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Processed
                </p>
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {errors.length}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Errors
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default BatchProcessor;
