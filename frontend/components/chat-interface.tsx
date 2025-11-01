"use client"

import React from "react"

import { useState, useRef } from "react"
import { Button } from "./ui/button"
import { Card } from "./ui/card"
import { Input } from "./ui/input"
import { Avatar, AvatarFallback } from "./ui/avatar"
import { ArrowLeft, Upload, Send, FileText, Image, X } from "lucide-react"
import type { Document } from "../app/page"
import { ApiClient } from "../lib/api"

interface ChatInterfaceProps {
  document: Document
  documents: Document[]
  onBack: () => void
  onSelectDocument: (document: Document, page?: number) => void
  onFileUpload: (files: FileList) => void
  onCitationClick?: (document: Document, page?: number) => void
  isEmbedded?: boolean
  externalMessage?: string | null
}

interface Message {
  id: string
  type: "user" | "ai" | "thinking"
  content: string
  isStreaming?: boolean
  citations?: Citation[]
  image?: {
    file: File
    preview: string
  }
}

interface Citation {
  id: number
  document_title: string
  document_id: string
  page?: number
}

export function ChatInterface({ document, documents, onBack, onSelectDocument, onFileUpload, onCitationClick, isEmbedded = false, externalMessage }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      type: "ai",
      content: `Hello! I'm Cerno Docs. I've analyzed your document, **${document.document_title}**. It contains ${document.chunk_count} sections that I can search through. Feel free to ask me any questions about it!`,
    },
  ])
  const [inputValue, setInputValue] = useState("")
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [isThinking, setIsThinking] = useState(false)
  const [uploadedImage, setUploadedImage] = useState<{ file: File, preview: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)

  // Thinking animation component
  const ThinkingAnimation = () => (
    <div className="flex items-center space-x-1 text-zinc-500">
      <span>AI is thinking</span>
      <div className="flex space-x-1">
        <div className="w-1 h-1 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
        <div className="w-1 h-1 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
        <div className="w-1 h-1 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
      </div>
    </div>
  )

  // Function to stream text character by character
  const streamText = (text: string, messageId: string, citations?: Citation[]) => {
    let index = 0
    const interval = setInterval(() => {
      if (index <= text.length) {
        const currentContent = text.slice(0, index)
        setMessages(prev => prev.map(msg =>
          msg.id === messageId
            ? {
              ...msg,
              content: currentContent,
              isStreaming: index < text.length,
              citations: citations || []
            }
            : msg
        ))
        index++
      } else {
        clearInterval(interval)
        // Final update to ensure citations are properly set
        setMessages(prev => prev.map(msg =>
          msg.id === messageId
            ? {
              ...msg,
              content: text,
              isStreaming: false,
              citations: citations || []
            }
            : msg
        ))
      }
    }, 20) // Adjust speed as needed
  }

  // Function to parse citations from response and convert to numbered format
  const parseCitationsFromResponse = (content: string): { text: string, citations: Citation[] } => {
    console.log('🔍 RAW API RESPONSE START 🔍')
    console.log(content)
    console.log('🔍 RAW API RESPONSE END 🔍')

    const citations: Citation[] = []

    // First, check if content contains any citation-like patterns
    const citationPattern = /\[(\d+)\]/g
    const citationMatches = content.match(citationPattern)
    console.log('Found citation patterns:', citationMatches)

    // Look for Sources section (with various formats)
    let sourcesMatch = content.match(/Sources?:\s*([\s\S]*?)$/i)

    // If no "Sources:" section, look for other patterns like "(See sections..."
    if (!sourcesMatch) {
      const seeMatch = content.match(/\(See sections? on ([^)]+)\)/i)
      if (seeMatch) {
        console.log('Found "See sections" pattern:', seeMatch[1])
        // Convert to mock sources format
        const sections = seeMatch[1].split(/,\s*(?:and\s*)?/)
        sections.forEach((section, index) => {
          citations.push({
            id: index + 1,
            document_title: section.trim(),
            document_id: `doc_${index + 1}`,
            page: undefined
          })
        })
      }
    }

    let mainText = content

    if (sourcesMatch) {
      const sourcesText = sourcesMatch[1]
      console.log('Found Sources section:', sourcesText)

      // Remove the entire sources section from the main text
      mainText = content.replace(sourcesMatch[0], '').trim()

      // Parse individual sources - handle multiple formats
      const sourceLines = sourcesText.split(/\n+/).filter(line => line.trim())
      console.log('Source lines:', sourceLines)

      sourceLines.forEach((line, index) => {
        console.log(`Processing source line ${index}:`, line)

        // Try multiple patterns
        // Pattern 1: "• [1] Document Name (PDF, Page X)"
        let match = line.match(/[•·]\s*\[(\d+)\]\s*(.*?)\s*(?:\((.*?),?\s*Page\s*(\d+)\)|$)/)
        if (!match) {
          // Pattern 2: "[1] Document Name (Page X)"
          match = line.match(/\[(\d+)\]\s*(.*?)\s*(?:\(Page\s*(\d+)\)|$)/)
        }
        if (!match) {
          // Pattern 3: "1. Document Name"
          match = line.match(/(\d+)\.\s*(.*?)(?:\s*\(Page\s*(\d+)\)|$)/)
        }
        if (!match) {
          // Pattern 4: "• [1] Document Name (Page X)" - numbered format
          match = line.match(/[•·]\s*\[(\d+)\]\s*(.*?)\s*(?:\(.*?Page\s*(\d+)\)|$)/)
        }
        if (!match) {
          // Pattern 5: "• Document Name (Page X)" - no number, assign index
          const simpleMatch = line.match(/[•·]\s*(.*?)\s*(?:\(.*?Page\s*(\d+)\)|$)/)
          if (simpleMatch) {
            // Create a match array with index-based numbering
            match = [simpleMatch[0], (index + 1).toString(), simpleMatch[1], simpleMatch[2]]
          }
        }

        if (match) {
          const citationNum = parseInt(match[1])
          let docTitle = match[2].trim()

          // Remove file type suffix if present (like "(PDF)")
          docTitle = docTitle.replace(/\s*\([^)]*\)\s*$/, '').trim()

          // Extract page number from the correct match group
          let pageNum: number | undefined = undefined

          // For Pattern 1: "• [1] Document Name (PDF, Page X)" - page is in match[4]
          if (match[4]) {
            pageNum = parseInt(match[4])
          }
          // For Pattern 2 and others: page might be in match[3]
          else if (match[3]) {
            pageNum = parseInt(match[3])
          }

          console.log(`Parsed citation: [${citationNum}] ${docTitle} (Page ${pageNum})`)

          citations.push({
            id: citationNum,
            document_title: docTitle,
            document_id: `doc_${citationNum}`,
            page: pageNum
          })
        } else {
          console.log('No match found for line:', line)
        }
      })
    }

    console.log('Final parsed citations:', citations)
    console.log('Main text after processing:', mainText)

    return { text: mainText, citations }
  }

  // Function to render text with clickable citation numbers
  const renderTextWithCitations = (text: string, citations: Citation[]) => {
    if (!citations.length) return text

    // Split text by citation patterns and render as React elements
    const parts: (string | React.ReactElement)[] = []
    let currentText = text
    let keyCounter = 0

    // Sort citations by their position in the text to process them in order
    const sortedCitations = [...citations].sort((a, b) => {
      const aIndex = currentText.indexOf(`[${a.id}]`)
      const bIndex = currentText.indexOf(`[${b.id}]`)
      return aIndex - bIndex
    })

    sortedCitations.forEach((citation) => {
      const citationPattern = `[${citation.id}]`
      const index = currentText.indexOf(citationPattern)

      if (index !== -1) {
        // Add text before citation
        if (index > 0) {
          parts.push(currentText.slice(0, index))
        }

        // Add clickable citation
        parts.push(
          <button
            key={`citation-${citation.id}-${keyCounter++}`}
            className="text-blue-400 hover:text-blue-300 underline cursor-pointer ml-0.5 mr-0.5"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              handleCitationClick(citation)
            }}
            title={`${citation.document_title}${citation.page ? ` (Page ${citation.page})` : ''}`}
          >
            {citationPattern}
          </button>
        )

        // Update currentText to the remaining part
        currentText = currentText.slice(index + citationPattern.length)
      }
    })

    // Add any remaining text
    if (currentText.length > 0) {
      parts.push(currentText)
    }

    return parts.length > 0 ? <>{parts}</> : text
  }

  // Function to render a line with both bold formatting and citations
  const renderLineWithFormattingAndCitations = (line: string, citations: Citation[]) => {
    console.log('Rendering line:', line)
    console.log('With citations:', citations)

    // If no citations, just handle bold formatting
    if (!citations.length) {
      if (line.includes('**')) {
        return line.split('**').map((part, j) =>
          j % 2 === 1 ? <strong key={j}>{part}</strong> : part
        )
      }
      return line
    }

    // Process citations and bold formatting together
    const parts: (string | React.ReactElement)[] = []
    let currentText = line
    let keyCounter = 0

    // Find all citation patterns in the text
    const citationMatches: { citation: Citation, index: number, pattern: string }[] = []
    citations.forEach(citation => {
      const pattern = `[${citation.id}]`
      let searchIndex = 0
      let index = currentText.indexOf(pattern, searchIndex)
      while (index !== -1) {
        citationMatches.push({ citation, index, pattern })
        searchIndex = index + pattern.length
        index = currentText.indexOf(pattern, searchIndex)
      }
    })

    // Sort by position in text
    citationMatches.sort((a, b) => a.index - b.index)

    console.log('Citation matches found:', citationMatches)

    let lastIndex = 0
    citationMatches.forEach(({ citation, index, pattern }) => {
      // Add text before citation (with bold formatting)
      if (index > lastIndex) {
        const textBefore = currentText.slice(lastIndex, index)
        if (textBefore.includes('**')) {
          parts.push(...textBefore.split('**').map((part, j) =>
            j % 2 === 1 ? <strong key={`bold-${keyCounter}-${j}`}>{part}</strong> : part
          ))
        } else {
          parts.push(textBefore)
        }
      }

      // Add clickable citation
      parts.push(
        <button
          key={`citation-${citation.id}-${keyCounter++}`}
          className="text-blue-400 hover:text-blue-300 underline cursor-pointer mx-0.5 font-medium"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            console.log('Citation button clicked:', citation)
            handleCitationClick(citation)
          }}
          onMouseDown={(e) => e.preventDefault()}
          title={`${citation.document_title}${citation.page ? ` (Page ${citation.page})` : ''}`}
          type="button"
        >
          [{citation.id}]
        </button>
      )

      lastIndex = index + pattern.length
      keyCounter++
    })

    // Add any remaining text (with bold formatting)
    if (lastIndex < currentText.length) {
      const remainingText = currentText.slice(lastIndex)
      if (remainingText.includes('**')) {
        parts.push(...remainingText.split('**').map((part, j) =>
          j % 2 === 1 ? <strong key={`bold-end-${j}`}>{part}</strong> : part
        ))
      } else {
        parts.push(remainingText)
      }
    }

    console.log('Rendered parts:', parts)
    return parts.length > 0 ? <>{parts}</> : line
  }

  // Function to handle citation clicks
  const handleCitationClick = (citation: Citation) => {
    console.log('Citation clicked:', citation)

    // Normalize title for better matching
    const normalizeTitle = (title: string) => {
      return title.toLowerCase()
        .replace(/\s*\([^)]*\)\s*/g, '') // Remove parentheses content
        .replace(/[^\w\s]/g, '') // Remove special characters
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim()
    }

    const normalizedCitationTitle = normalizeTitle(citation.document_title)

    // Find the document in the documents list with improved matching
    const targetDoc = documents.find(doc => {
      const normalizedDocTitle = normalizeTitle(doc.document_title)
      return normalizedDocTitle.includes(normalizedCitationTitle) ||
        normalizedCitationTitle.includes(normalizedDocTitle) ||
        doc.document_id === citation.document_id
    })

    console.log('Normalized citation title:', normalizedCitationTitle)
    console.log('Target document found:', targetDoc)
    console.log('Available documents:', documents.map(doc => ({
      id: doc.document_id,
      title: doc.document_title,
      normalized: normalizeTitle(doc.document_title)
    })))

    if (targetDoc) {
      console.log('Calling onSelectDocument with:', targetDoc)

      // Use the new onCitationClick prop if available (for embedded mode)
      if (onCitationClick) {
        onCitationClick(targetDoc, citation.page)
      } else {
        // Fallback to the original onSelectDocument for standalone mode
        onSelectDocument(targetDoc, citation.page)
      }

      console.log('Citation navigation called successfully')

      // If there's a page number, you could potentially scroll to that page
      if (citation.page) {
        console.log(`Opening document: ${citation.document_title} at page ${citation.page}`)
        // You could add page navigation logic here
      }
    } else {
      console.log(`Document not found: ${citation.document_title}`)
      alert(`Document "${citation.document_title}" not found in your library. Please upload it first.`)
    }
  }

  function getScoreColor(score: number) {
    if (score >= 80) return "text-green-500"
    if (score >= 60) return "text-yellow-500"
    return "text-red-500"
  }

  const handleSendMessage = async () => {
    if ((!inputValue.trim() && !uploadedImage) || isThinking) return

    // Handle image upload with question
    if (uploadedImage) {
      const newMessage: Message = {
        id: Date.now().toString(),
        type: "user",
        content: inputValue || "Analyze this image",
        image: uploadedImage,
      }

      setMessages((prev) => [...prev, newMessage])
      const currentQuestion = inputValue || "What do you see in this image?"
      setInputValue("")
      setUploadedImage(null)
      setIsThinking(true)

      // Add thinking message
      const thinkingMessage: Message = {
        id: `thinking_${Date.now()}`,
        type: "thinking",
        content: "",
      }
      setMessages((prev) => [...prev, thinkingMessage])

      try {
        // Call streaming image analysis API
        const formData = new FormData()
        formData.append('image', uploadedImage.file)
        formData.append('question', currentQuestion)

        const response = await fetch('http://localhost:8000/v1/ragsys/analyze-image', {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          throw new Error('Failed to analyze image')
        }

        // Remove thinking message and add streaming response
        setMessages((prev) => prev.filter(msg => msg.type !== "thinking"))

        const aiResponse: Message = {
          id: Date.now().toString(),
          type: "ai",
          content: "",
          isStreaming: true,
        }

        setMessages((prev) => [...prev, aiResponse])

        // Handle streaming response
        const reader = response.body?.getReader()
        const decoder = new TextDecoder()
        let buffer = ""

        if (reader) {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() || ""

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6))

                  if (data.chunk) {
                    // Update the streaming message with new content
                    setMessages((prev) =>
                      prev.map(msg =>
                        msg.id === aiResponse.id
                          ? { ...msg, content: msg.content + data.chunk }
                          : msg
                      )
                    )
                  } else if (data.done) {
                    // Mark streaming as complete
                    setMessages((prev) =>
                      prev.map(msg =>
                        msg.id === aiResponse.id
                          ? { ...msg, isStreaming: false }
                          : msg
                      )
                    )
                    console.log(`✅ Image analysis completed in ${data.processing_time?.toFixed(2)}s`)
                  } else if (data.error) {
                    throw new Error(data.error)
                  }
                } catch (parseError) {
                  console.warn('Failed to parse streaming data:', parseError)
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('Error analyzing image:', error)
        setMessages((prev) => prev.filter(msg => msg.type !== "thinking"))

        const errorResponse: Message = {
          id: Date.now().toString(),
          type: "ai",
          content: "Sorry, I couldn't analyze the image. Please try again.",
        }
        setMessages((prev) => [...prev, errorResponse])
      } finally {
        setIsThinking(false)
      }
      return
    }

    // Regular text message handling
    const newMessage: Message = {
      id: Date.now().toString(),
      type: "user",
      content: inputValue,
    }

    setMessages((prev) => [...prev, newMessage])
    const currentQuestion = inputValue
    setInputValue("")
    setIsThinking(true)

    // Add thinking message
    const thinkingMessage: Message = {
      id: `thinking_${Date.now()}`,
      type: "thinking",
      content: "",
    }
    setMessages((prev) => [...prev, thinkingMessage])

    try {
      // Call the API to get a real response
      const api = new ApiClient()
      const response = await api.askQuestions([currentQuestion], [document.document_id])

      // Remove thinking message
      setMessages((prev) => prev.filter(msg => msg.type !== "thinking"))

      const responseText = response.answers[0] || "I couldn't process your question at the moment."

      // Add detailed logging
      console.log('=== FULL API RESPONSE DEBUG ===')
      console.log('Full response object:', response)
      console.log('Response text:', responseText)
      console.log('Response length:', responseText.length)
      console.log('=== END API RESPONSE DEBUG ===')

      const { text, citations } = parseCitationsFromResponse(responseText)

      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        type: "ai",
        content: "",
        isStreaming: true,
        citations,
      }

      setMessages((prev) => [...prev, aiResponse])

      // Stream the response
      streamText(text, aiResponse.id, citations)

    } catch (error) {
      console.error('Failed to get AI response:', error)

      // Remove thinking message
      setMessages((prev) => prev.filter(msg => msg.type !== "thinking"))

      const errorResponse: Message = {
        id: (Date.now() + 1).toString(),
        type: "ai",
        content: "",
        isStreaming: true,
      }
      setMessages((prev) => [...prev, errorResponse])
      streamText("I'm sorry, I encountered an error while processing your question. Please try again.", errorResponse.id)
    } finally {
      setIsThinking(false)
    }
  }

  // Handle external messages from document viewer
  React.useEffect(() => {
    if (externalMessage && externalMessage.trim() && !isThinking) {
      // Create a new message directly
      const newMessage: Message = {
        id: Date.now().toString(),
        type: "user",
        content: externalMessage,
      }

      setMessages((prev) => [...prev, newMessage])
      setIsThinking(true)

      // Add thinking message
      const thinkingMessage: Message = {
        id: `thinking_${Date.now()}`,
        type: "thinking",
        content: "",
      }
      setMessages((prev) => [...prev, thinkingMessage])

      // Process the message
      const processExternalMessage = async () => {
        try {
          const api = new ApiClient()
          const response = await api.askQuestions([externalMessage], [document.document_id])

          setMessages((prev) => prev.filter(msg => msg.type !== "thinking"))

          const responseText = response.answers[0] || "I couldn't process your question at the moment."
          const { text, citations } = parseCitationsFromResponse(responseText)

          const aiResponse: Message = {
            id: (Date.now() + 1).toString(),
            type: "ai",
            content: "",
            isStreaming: true,
            citations,
          }

          setMessages((prev) => [...prev, aiResponse])
          streamText(text, aiResponse.id, citations)
        } catch (error) {
          console.error('Failed to process external message:', error)
          setMessages((prev) => prev.filter(msg => msg.type !== "thinking"))

          const errorResponse: Message = {
            id: (Date.now() + 1).toString(),
            type: "ai",
            content: "I'm sorry, I encountered an error while processing your question. Please try again.",
          }
          setMessages((prev) => [...prev, errorResponse])
        } finally {
          setIsThinking(false)
        }
      }

      processExternalMessage()
    }
  }, [externalMessage, isThinking, document.document_id])

  const handleFileUpload = (files: FileList) => {
    onFileUpload(files)
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFileUpload(e.target.files)
    }
  }

  const handleImageUpload = () => {
    imageInputRef.current?.click()
  }

  const handleImageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type.startsWith('image/')) {
      // Validate file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        alert('Image file too large. Maximum size is 10MB.')
        return
      }

      const preview = URL.createObjectURL(file)
      setUploadedImage({ file, preview })
    } else {
      alert('Please select a valid image file.')
    }

    // Reset input
    if (e.target) {
      e.target.value = ''
    }
  }

  const removeUploadedImage = () => {
    if (uploadedImage) {
      URL.revokeObjectURL(uploadedImage.preview)
      setUploadedImage(null)
    }
  }

  return (
    <div className={`${isEmbedded ? 'h-full' : 'min-h-screen'} ${isEmbedded ? 'bg-zinc-900' : 'bg-black'} ${isEmbedded ? 'text-white' : 'text-white'} flex`}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword"
        multiple
        onChange={handleFileInputChange}
        className="hidden"
      />

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageInputChange}
        className="hidden"
      />

      {/* Left Sidebar */}
      <div
        className={`${sidebarCollapsed ? "w-0" : "w-64"} transition-all duration-300 border-r border-zinc-800 flex flex-col`}
      >
        <div className="p-3 border-b border-zinc-800">
          <div className="flex gap-1 mb-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="text-zinc-400 hover:text-white text-xs px-2 py-1 h-auto"
            >
              <ArrowLeft className="w-3 h-3 mr-1" />
              Library
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-zinc-400 hover:text-white text-xs px-2 py-1 h-auto"
              onClick={handleUploadClick}
            >
              <Upload className="w-3 h-3 mr-1" />
              Upload
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <h3 className="text-xs font-medium text-zinc-400 mb-2">Documents</h3>
          <div className="space-y-1">
            {documents
              .filter((d) => !d.isProcessing)
              .map((doc) => (
                <div
                  key={doc.document_id}
                  className={`p-2 rounded cursor-pointer transition-colors ${doc.document_id === document.document_id ? "bg-white/10 border border-white/20" : "bg-zinc-900 hover:bg-zinc-800"
                    }`}
                  onClick={() => onSelectDocument(doc)}
                >
                  <div className="flex items-center gap-2">
                    <FileText className="w-3 h-3 text-zinc-400" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{doc.document_title}</p>
                      <p className="text-xs text-zinc-500">{new Date(doc.processed_timestamp).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}</p>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Center Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <header className="border-b border-zinc-800 px-4 py-3">
          <h2 className="text-sm font-medium">{document.document_title}</h2>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.type === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-xl ${message.type === "user" ? "order-2" : "order-1"}`}>
                {(message.type === "ai" || message.type === "thinking") && (
                  <div className="flex items-center gap-2 mb-1">
                    <Avatar className="w-4 h-4">
                      <AvatarFallback className="bg-white text-black text-xs">AI</AvatarFallback>
                    </Avatar>
                    <span className="text-xs text-zinc-400">AI Assistant</span>
                  </div>
                )}
                <div
                  className={`p-3 rounded text-sm ${message.type === "user" ? "bg-zinc-800 text-white" : "bg-zinc-900 text-zinc-100"
                    }`}
                >
                  {message.type === "thinking" ? (
                    <ThinkingAnimation />
                  ) : (
                    <div className="prose prose-invert prose-sm max-w-none">
                      {/* Display image if present */}
                      {message.image && (
                        <div className="mb-3">
                          <img
                            src={message.image.preview}
                            alt="Uploaded image"
                            className="max-w-xs max-h-48 rounded border border-zinc-600 object-cover"
                          />
                        </div>
                      )}

                      {message.content.split("\n").map((line, i) => (
                        <p key={i} className="mb-1 last:mb-0 text-sm">
                          {renderLineWithFormattingAndCitations(line, message.citations || [])}
                        </p>
                      ))}
                      {message.isStreaming && (
                        <span className="inline-block w-2 h-4 bg-white animate-pulse ml-1"></span>
                      )}
                    </div>
                  )}

                  {/* Citations */}
                  {message.citations && message.citations.length > 0 && !message.isStreaming && (
                    <div className="mt-3 pt-3 border-t border-zinc-700">
                      <div className="text-xs text-zinc-400 mb-2">Sources:</div>
                      {message.citations.map((citation) => (
                        <div key={citation.id} className="text-xs text-zinc-300 mb-1">
                          <button
                            className="text-blue-400 hover:text-blue-300 underline cursor-pointer"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              console.log('Source citation clicked:', citation)
                              handleCitationClick(citation)
                            }}
                            type="button"
                          >
                            [{citation.id}] {citation.document_title}
                            {citation.page && ` (Page ${citation.page})`}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Chat Input */}
        <div className="border-t border-zinc-800 p-4">
          {/* Image Preview */}
          {uploadedImage && (
            <div className="mb-3 relative inline-block">
              <img
                src={uploadedImage.preview}
                alt="Image to analyze"
                className="max-w-xs max-h-32 rounded border border-zinc-600 object-cover"
              />
              <button
                onClick={removeUploadedImage}
                className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 text-xs"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={handleImageUpload}
              className="bg-zinc-700 hover:bg-zinc-600 text-white h-8 px-3"
              disabled={isThinking}
              title="Upload image"
            >
              <Image className="w-3 h-3" />
            </Button>
            <Input
              value={inputValue}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInputValue(e.target.value)}
              placeholder={uploadedImage ? "Ask a question about the image..." : "Type your question here..."}
              className="flex-1 bg-transparent border-none text-sm focus:outline-none text-white placeholder-zinc-500"
              onKeyPress={(e: React.KeyboardEvent) => e.key === "Enter" && !isThinking && handleSendMessage()}
              disabled={isThinking}
            />
            <Button
              onClick={handleSendMessage}
              className="bg-white hover:bg-zinc-200 text-black h-8 px-3"
              disabled={isThinking || (!inputValue.trim() && !uploadedImage)}
            >
              <Send className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
