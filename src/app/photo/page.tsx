'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'

export default function PhotoPage() {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [captured, setCaptured] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [groupId, setGroupId] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/team').then(r => {
      if (r.status === 401) { router.replace('/'); return null }
      return r.json()
    }).then(data => {
      if (!data) return
      if (!data.group_id) { router.replace('/mypage'); return }
      setGroupId(data.group_id)
    })
  }, [router])

  const startCamera = useCallback(async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      })
      setStream(s)
      if (videoRef.current) videoRef.current.srcObject = s
    } catch {
      setError('カメラの起動に失敗しました。ブラウザの許可を確認してください。')
    }
  }, [])

  useEffect(() => {
    if (groupId) startCamera()
    return () => { stream?.getTracks().forEach(t => t.stop()) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId])

  function capture() {
    if (!videoRef.current || !canvasRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')?.drawImage(video, 0, 0)
    setCaptured(canvas.toDataURL('image/jpeg', 0.85))
    stream?.getTracks().forEach(t => t.stop())
    setStream(null)
  }

  function retake() {
    setCaptured(null)
    setError('')
    startCamera()
  }

  async function upload() {
    if (!captured) return
    setUploading(true)
    setError('')

    const blob = await new Promise<Blob>(resolve => {
      canvasRef.current!.toBlob(b => resolve(b!), 'image/jpeg', 0.85)
    })
    const fd = new FormData()
    fd.append('photo', blob, 'group_photo.jpg')

    const res = await fetch('/api/photo', { method: 'POST', body: fd })
    const data = await res.json()
    if (!res.ok) { setError(data.error); setUploading(false); return }

    setDone(true)
    setUploading(false)
  }

  if (done) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-50">
        <div className="text-6xl mb-4">✅</div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">写真を保存しました！</h2>
        <Link href="/mypage" className="mt-6 bg-blue-600 text-white px-8 py-3 rounded-xl font-semibold">
          ホームへ戻る
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <div className="flex items-center gap-3 px-4 py-4 bg-black/80">
        <Link href="/mypage" className="text-gray-400 hover:text-white text-xl">←</Link>
        <h1 className="text-white font-bold">集合写真を撮る</h1>
      </div>

      {error && (
        <div className="mx-4 mt-2 bg-red-900/50 text-red-200 rounded-lg p-3 text-sm">{error}</div>
      )}

      <div className="flex-1 relative">
        {!captured ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
        ) : (
          <Image src={captured} alt="撮影した写真" fill className="object-contain" />
        )}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      <div className="p-6 bg-black/80 flex justify-center gap-6">
        {!captured ? (
          <button
            onClick={capture}
            disabled={!stream}
            className="w-20 h-20 rounded-full bg-white border-4 border-gray-400 hover:bg-gray-100 disabled:opacity-50 transition flex items-center justify-center text-3xl"
          >
            📷
          </button>
        ) : (
          <>
            <button
              onClick={retake}
              className="flex-1 bg-gray-700 text-white py-4 rounded-xl font-semibold hover:bg-gray-600 transition"
            >
              撮り直す
            </button>
            <button
              onClick={upload}
              disabled={uploading}
              className="flex-1 bg-blue-600 text-white py-4 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {uploading ? '保存中...' : '保存する'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
