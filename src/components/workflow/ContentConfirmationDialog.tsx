'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, XCircle, MessageSquare, FileText } from 'lucide-react'

interface ContentConfirmationDialogProps {
  isOpen: boolean
  sectionName: string
  content: string
  onConfirm: (approved: boolean, feedback?: string) => void
  onClose: () => void
}

export function ContentConfirmationDialog({
  isOpen,
  sectionName,
  content,
  onConfirm,
  onClose
}: ContentConfirmationDialogProps) {
  const [feedback, setFeedback] = useState('')
  const [showFeedback, setShowFeedback] = useState(false)

  const handleApprove = () => {
    onConfirm(true)
    resetDialog()
  }

  const handleReject = () => {
    if (!showFeedback) {
      setShowFeedback(true)
      return
    }
    
    onConfirm(false, feedback)
    resetDialog()
  }

  const resetDialog = () => {
    setFeedback('')
    setShowFeedback(false)
    onClose()
  }

  const wordCount = content.split(/\s+/).filter(word => word.length > 0).length
  const estimatedReadTime = Math.ceil(wordCount / 200) // Average reading speed: 200 words per minute

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Review Generated Content: {sectionName}
          </DialogTitle>
          <DialogDescription>
            Please review the AI-generated content below. You can approve it as-is or provide feedback for improvements.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-hidden">
          {/* Content Stats */}
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <Badge variant="outline" className="flex items-center gap-1">
              <span>{wordCount} words</span>
            </Badge>
            <Badge variant="outline" className="flex items-center gap-1">
              <span>{estimatedReadTime} min read</span>
            </Badge>
          </div>

          {/* Generated Content */}
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-4 py-2 border-b">
              <h3 className="font-medium text-gray-900">Generated Content</h3>
            </div>
            <ScrollArea className="h-[400px] p-4">
              <div className="prose prose-sm max-w-none">
                {content.split('\n').map((paragraph, index) => (
                  <p key={index} className="mb-3 text-gray-700 leading-relaxed">
                    {paragraph}
                  </p>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Feedback Section */}
          {showFeedback && (
            <div className="space-y-3">
              <Label htmlFor="feedback" className="text-base font-medium">
                Provide feedback for improvement
              </Label>
              <Textarea
                id="feedback"
                placeholder="Please describe what changes you'd like to see in the content. Be specific about style, tone, technical details, or any missing information..."
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                className="min-h-[100px]"
              />
              <p className="text-sm text-gray-600">
                Your feedback will be used to regenerate improved content.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex-shrink-0">
          <div className="flex items-center gap-2 w-full">
            {!showFeedback ? (
              <>
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleReject}
                  className="flex items-center gap-2"
                >
                  <XCircle className="h-4 w-4" />
                  Request Changes
                </Button>
                <Button
                  onClick={handleApprove}
                  className="flex items-center gap-2"
                >
                  <CheckCircle className="h-4 w-4" />
                  Approve Content
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => setShowFeedback(false)}
                >
                  Back
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleReject}
                  disabled={!feedback.trim()}
                  className="flex items-center gap-2"
                >
                  <MessageSquare className="h-4 w-4" />
                  Submit Feedback & Regenerate
                </Button>
              </>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}