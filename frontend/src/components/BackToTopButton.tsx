import { useEffect, useState } from "react"

interface BackToTopButtonProps {
  language?: string
}

// Distance scrolled before the button appears, so it stays out of the way
// until there is actually something to scroll back from.
const revealOffset = 300

const BackToTopButton = ({ language }: BackToTopButtonProps) => {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    let frame = 0

    const update = () => {
      frame = 0
      setIsVisible(window.scrollY > revealOffset)
    }

    const schedule = () => {
      if (frame) {
        return
      }
      frame = window.requestAnimationFrame(update)
    }

    schedule()
    window.addEventListener("scroll", schedule, { passive: true })
    window.addEventListener("resize", schedule)

    return () => {
      if (frame) {
        window.cancelAnimationFrame(frame)
      }
      window.removeEventListener("scroll", schedule)
      window.removeEventListener("resize", schedule)
    }
  }, [])

  if (!isVisible) {
    return null
  }

  const label = language === "swe" ? "Tillbaka till början" : "Takaisin alkuun"

  // Matches sideToggleButtonStyle in DocumentPage (the "Piilota haku" /
  // "Sisallysluettelo" toggles), with a little more padding since this one
  // floats over the document. The shadow lifts it off the white body text.
  const style: React.CSSProperties = {
    position: "fixed",
    right: "16px",
    bottom: "16px",
    zIndex: 999,
    color: "#0C6FC0",
    textDecoration: "none",
    border: "1px solid #0C6FC0",
    padding: "6px 12px",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "13px",
    backgroundColor: "#FFFFFF",
    whiteSpace: "nowrap",
    boxShadow: "0 1px 4px rgba(0, 0, 0, 0.25)",
  }

  const handleClick = () => {
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  return (
    <button
      type="button"
      id="back-to-top"
      style={style}
      onClick={handleClick}
      aria-label={label}
      title={label}
    >
      {`\u2191 ${label}`}
    </button>
  )
}

export default BackToTopButton
