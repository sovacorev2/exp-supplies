'use client'

import { useState } from 'react'
import { X, Download } from 'lucide-react'

interface ImagePreviewModalProps {
  imageUrl: string
  fileName: string
  onClose: () => void
}

export function ImagePreviewModal({ imageUrl, fileName, onClose }: ImagePreviewModalProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(false)

  // Use proxy for private Blob URLs, direct URL for filenames
  const isBlobUrl = imageUrl.startsWith('https://')
  const displayUrl = isBlobUrl ? `/api/image-proxy?url=${encodeURIComponent(imageUrl)}` : imageUrl

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700 sticky top-0 bg-gray-900">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-white truncate">{fileName}</h3>
          </div>
          <div className="flex items-center gap-2 ml-4">
            {isBlobUrl && (
              <a
                href={displayUrl}
                download={fileName}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors text-gray-300 hover:text-white"
                title="Download image"
              >
                <Download size={20} />
              </a>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors text-gray-300 hover:text-white"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Image Container */}
        <div className="flex-1 flex items-center justify-center p-4 bg-black/30">
          {error ? (
            <div className="text-center">
              <p className="text-red-400 mb-2">Failed to load image</p>
              <p className="text-sm text-gray-400">{fileName}</p>
            </div>
          ) : (
            <>
              {isLoading && (
                <div className="absolute">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-500"></div>
                </div>
              )}
              <img
                src={displayUrl}
                alt={fileName}
                onLoad={() => setIsLoading(false)}
                onError={() => {
                  setIsLoading(false)
                  setError(true)
                }}
                className={`max-w-full max-h-full object-contain ${isLoading ? 'invisible' : 'visible'}`}
              />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
