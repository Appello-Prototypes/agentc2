export {
    createDocument,
    updateDocument,
    deleteDocument,
    getDocument,
    listDocuments,
    searchDocuments,
    reembedDocument,
    getDocumentVersions,
    // Aliased re-exports for backward compatibility with barrel consumers
    createDocument as createDocumentRecord,
    updateDocument as updateDocumentRecord,
    deleteDocument as deleteDocumentRecord,
    getDocument as getDocumentRecord,
    listDocuments as listDocumentRecords,
    searchDocuments as searchDocumentRecords,
    type CreateDocumentInput,
    type UpdateDocumentInput,
    type ListDocumentsInput,
    type SearchDocumentsInput
} from "./service";
