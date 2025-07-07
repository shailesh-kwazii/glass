'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'

export default function LoginPage() {
  const router = useRouter()
  const [isElectronMode, setIsElectronMode] = useState(false)

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const mode = urlParams.get('mode')
    setIsElectronMode(mode === 'electron')
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Welcome to Pickle Glass</h1>
        <p className="text-gray-600 mt-2">Your AI-powered desktop assistant - now running in local mode only.</p>
        <p className="text-sm text-gray-500 mt-1">All your data stays local and private.</p>
      </div>
      
      <div className="w-full max-w-sm">
        <div className="bg-white p-8 rounded-lg shadow-md border border-gray-200">
          <button
            onClick={() => {
              if (isElectronMode) {
                window.location.href = 'pickleglass://auth-success?uid=default_user&email=contact@pickle.com&displayName=Default%20User'
              } else {
                router.push('/settings')
              }
            }}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-blue-600 text-white rounded-md shadow-sm text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <span>Continue to Glass</span>
          </button>
        </div>
        
        <p className="text-center text-xs text-gray-500 mt-6">
          By using Glass, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  )
} 