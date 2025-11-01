"use client"

import type React from "react"

import { Button } from "./ui/button"
import { Card } from "./ui/card"
import { Avatar, AvatarFallback } from "./ui/avatar"
import { Upload, FileText, Loader2, Trash2 } from "lucide-react"
import type { Document } from "@/app/page"
import { useRef, useState, type DragEvent } from "react"

interface DocumentLibraryProps {
  documents: Document[]
  onSelectDocument: (document: Document) => void
  onFileUpload: (files: FileList) => void
  onDeleteDocument?: (documentId: string) => void
}

export function DocumentLibrary({ documents, onSelectDocument, onFileUpload, onDeleteDocument }: DocumentLibraryProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      onFileUpload(files)
    }
    // Reset input value to allow uploading the same file again
    e.target.value = ""
  }

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)

    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      onFileUpload(files)
    }
  }

  const handleDeleteDocument = (documentId: string, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent card click
    if (onDeleteDocument && confirm('Are you sure you want to delete this document?')) {
      onDeleteDocument(documentId)
    }
  }

  return (
    <div
      className={`min-h-screen bg-black text-white transition-colors ${isDragOver ? "bg-zinc-900" : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,text/plain"
        multiple
        onChange={handleFileChange}
        className="hidden"
      />

      {isDragOver && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-8 text-center">
            <Upload className="w-12 h-12 text-white mx-auto mb-4" />
            <p className="text-white text-lg font-medium">Drop files here</p>
            <p className="text-zinc-400 text-sm mt-2">PDF, DOCX, and TXT files supported</p>
          </div>
        </div>
      )}

      <header className="border-b border-zinc-800 px-6 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <h1 className="text-lg font-medium text-white">Cerno Docs</h1>
          <Avatar className="w-7 h-7">
            <AvatarFallback className="bg-zinc-800 text-white text-sm">CD</AvatarFallback>
          </Avatar>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <Button
            onClick={handleUploadClick}
            className="bg-white hover:bg-zinc-100 text-black px-4 py-2 text-sm font-medium"
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map((document) => (
            <Card
              key={document.document_id}
              className={`relative bg-black border-zinc-900 hover:border-zinc-800 transition-all duration-200 cursor-pointer group ${document.isProcessing ? "opacity-60" : ""}`}
              onClick={() => !document.isProcessing && onSelectDocument(document)}
            >
              <div className="p-4">
                <div className="flex items-center gap-4">
                  {/* File Icon */}
                  <div className="flex-shrink-0">
                    {document.isProcessing ? (
                      <Loader2 className="w-8 h-8 text-zinc-500 animate-spin" />
                    ) : (
                      <FileText className="w-8 h-8 text-zinc-400" />
                    )}
                  </div>

                  {/* Document Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium text-white text-sm truncate">
                        {document.document_title}
                      </h3>
                      {/* Delete button - integrated into header */}
                      {!document.isProcessing && onDeleteDocument && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 border border-red-500/50 text-red-400 hover:text-red-300 hover:bg-red-500/10 hover:border-red-400 transition-all"
                          onClick={(e) => handleDeleteDocument(document.document_id, e)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>

                    <p className="text-xs text-zinc-500 mb-3">
                      {document.isProcessing ? "Analyzing..." : new Date(document.processed_timestamp).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </main>
    </div>
  )
}
