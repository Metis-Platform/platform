'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'

type Message = { role: 'user' | 'assistant'; content: string }
type ChatState = 'idle' | 'streaming' | 'error'

const SUGGESTIONS = [
  'What is my most urgent deadline?',
  'How many active TAX_LIEN deals do I have?',
  "What are my open tasks this week?",
  "Summarize my portfolio by strategy.",
]

export default function CopilotPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [chatState, setChatState] = useState<ChatState>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [settingsUrl, setSettingsUrl] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(text: string) {
    const trimmed = text.trim()
    if (!trimmed || chatState === 'streaming') return

    const userMessage: Message = { role: 'user', content: trimmed }
    const nextHistory = [...messages, userMessage]
    setMessages(nextHistory)
    setInput('')
    setChatState('streaming')
    setErrorMsg('')

    // Placeholder for streaming assistant message
    setMessages(prev => [...prev, { role: 'assistant', content: '' }])

    try {
      const res = await fetch('/api/ai/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextHistory }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string; settingsUrl?: string }
        setMessages(prev => prev.slice(0, -1)) // remove placeholder
        setErrorMsg(data.error ?? 'Request failed')
        setSettingsUrl(data.settingsUrl ?? '')
        setChatState('error')
        return
      }

      const reader = res.body?.getReader()
      if (!reader) { setChatState('error'); setErrorMsg('No response body'); return }

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const payload = line.slice(6).trim()
          if (payload === '[DONE]') break
          try {
            const parsed = JSON.parse(payload) as { text?: string; error?: string }
            if (parsed.error) {
              setMessages(prev => prev.slice(0, -1))
              setErrorMsg(parsed.error!)
              setChatState('error')
              return
            }
            if (parsed.text) {
              setMessages(prev => {
                const copy = [...prev]
                copy[copy.length - 1] = {
                  ...copy[copy.length - 1],
                  content: copy[copy.length - 1].content + parsed.text,
                }
                return copy
              })
            }
          } catch {
            // ignore malformed SSE line
          }
        }
      }

      setChatState('idle')
    } catch {
      setMessages(prev => prev.slice(0, -1))
      setErrorMsg('Network error. Please try again.')
      setChatState('error')
    }

    inputRef.current?.focus()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] max-w-3xl mx-auto">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Deal Copilot</h1>
          <p className="text-xs text-zinc-500 mt-0.5">Ask questions about your portfolio — deals, deadlines, financials, tasks.</p>
        </div>
        <Link href="/dashboard/settings/ai" className="text-xs text-zinc-400 hover:text-zinc-700 underline">
          AI settings
        </Link>
      </div>

      {/* Message area */}
      <div className="flex-1 overflow-y-auto border border-zinc-200 rounded-xl bg-white p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <div className="text-3xl">🤖</div>
            <p className="text-sm text-zinc-500 max-w-xs">
              Ask me anything about your portfolio. I have access to your live deal data, deadlines, and tasks.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="text-xs px-3 py-1.5 rounded-full border border-zinc-200 text-zinc-600 hover:border-zinc-400 hover:text-zinc-900 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-zinc-900 text-white'
                      : 'bg-zinc-50 border border-zinc-200 text-zinc-800'
                  }`}
                >
                  {msg.content || (chatState === 'streaming' && i === messages.length - 1 ? (
                    <span className="inline-flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </span>
                  ) : null)}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Error */}
      {chatState === 'error' && errorMsg && (
        <div className="mt-2 text-xs text-red-600 px-1">
          {errorMsg}
          {settingsUrl && (
            <Link href={settingsUrl} className="ml-1 font-medium underline">
              Add your API key →
            </Link>
          )}
        </div>
      )}

      {/* Input */}
      <div className="mt-3 flex gap-2 items-end">
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your deals, deadlines, or portfolio…"
          disabled={chatState === 'streaming'}
          rows={1}
          className="flex-1 text-sm border border-zinc-300 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 resize-none"
          style={{ maxHeight: '120px', overflowY: 'auto' }}
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={!input.trim() || chatState === 'streaming'}
          className="px-4 py-2.5 text-sm font-medium bg-zinc-900 text-white rounded-xl hover:bg-zinc-700 disabled:opacity-50 transition-colors flex-shrink-0"
        >
          {chatState === 'streaming' ? '…' : 'Send'}
        </button>
      </div>
      <p className="mt-1.5 text-[11px] text-zinc-400 text-center">
        Press Enter to send · Shift+Enter for newline · Session history is not saved
      </p>
    </div>
  )
}
