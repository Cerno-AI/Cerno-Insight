// API client for backend integration
const API_BASE_URL = 'http://localhost:8000/api/v1/ragsys'

export interface DocumentResponse {
    document_id: string
    document_url: string
    document_title: string
    file_type: string
    chunk_count: number
    processed_timestamp: string
}

export interface UploadResponse {
    message: string
    document_id: string
    processing_time: number
    total_chunks: number
}

export interface AskResponse {
    answers: string[]
}

export interface StatsResponse {
    stats: {
        collection_name: string
        total_chunks: number
        total_documents: number
        file_types: Record<string, number>
        last_updated: string
        persist_directory: string
    }
}

class ApiClient {
    private baseUrl: string

    constructor(baseUrl: string = API_BASE_URL) {
        this.baseUrl = baseUrl
    }

    // Upload a file
    async uploadFile(file: File, customFilename?: string): Promise<UploadResponse> {
        const formData = new FormData()
        formData.append('file', file)
        if (customFilename) {
            formData.append('custom_filename', customFilename)
        }

        const response = await fetch(`${this.baseUrl}/upload-file`, {
            method: 'POST',
            body: formData,
        })

        if (!response.ok) {
            const error = await response.json()
            throw new Error(error.detail || 'Failed to upload file')
        }

        return response.json()
    }

    // Upload a document by URL
    async uploadUrl(documentUrl: string): Promise<UploadResponse> {
        const response = await fetch(`${this.baseUrl}/upload`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ document_url: documentUrl }),
        })

        if (!response.ok) {
            const error = await response.json()
            throw new Error(error.detail || 'Failed to upload document')
        }

        return response.json()
    }

    // Ask questions about documents
    async askQuestions(questions: string[], documentIds?: string[]): Promise<AskResponse> {
        const payload: any = { questions }
        if (documentIds && documentIds.length > 0) {
            payload.document_ids = documentIds
        }

        const response = await fetch(`${this.baseUrl}/ask`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        })

        if (!response.ok) {
            const error = await response.json()
            throw new Error(error.detail || 'Failed to get answer')
        }

        return response.json()
    }

    // List all documents
    async listDocuments(): Promise<{ documents: DocumentResponse[], stats: any }> {
        const response = await fetch(`${this.baseUrl}/documents`, {
            method: 'GET',
        })

        if (!response.ok) {
            const error = await response.json()
            throw new Error(error.detail || 'Failed to list documents')
        }

        return response.json()
    }

    // Get specific document info
    async getDocument(documentId: string): Promise<{ document: DocumentResponse }> {
        const response = await fetch(`${this.baseUrl}/documents/${documentId}`, {
            method: 'GET',
        })

        if (!response.ok) {
            const error = await response.json()
            throw new Error(error.detail || 'Failed to get document')
        }

        return response.json()
    }

    // Delete a document
    async deleteDocument(documentId: string): Promise<{ message: string }> {
        const response = await fetch(`${this.baseUrl}/documents/${documentId}`, {
            method: 'DELETE',
        })

        if (!response.ok) {
            const error = await response.json()
            throw new Error(error.detail || 'Failed to delete document')
        }

        return response.json()
    }

    // Reprocess a document
    async reprocessDocument(documentUrl: string): Promise<UploadResponse> {
        const response = await fetch(`${this.baseUrl}/documents/reprocess`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ document_url: documentUrl }),
        })

        if (!response.ok) {
            const error = await response.json()
            throw new Error(error.detail || 'Failed to reprocess document')
        }

        return response.json()
    }

    // Get database statistics
    async getStats(): Promise<StatsResponse> {
        const response = await fetch(`${this.baseUrl}/stats`, {
            method: 'GET',
        })

        if (!response.ok) {
            const error = await response.json()
            throw new Error(error.detail || 'Failed to get stats')
        }

        return response.json()
    }
}

// Default instance
const apiClient = new ApiClient()

export { ApiClient, apiClient }