import { useEffect, useRef, useState } from 'react'

// Trả về true một lần duy nhất khi phần tử cuộn vào màn hình (dùng cho hiệu ứng hiện dần)
export default function useInView({ threshold = 0.15 } = {}) {
  const ref = useRef(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    if (!('IntersectionObserver' in window)) { setInView(true); return }
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      setInView(true)
      observer.disconnect()
    }, { threshold })
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [threshold])

  return [ref, inView]
}
