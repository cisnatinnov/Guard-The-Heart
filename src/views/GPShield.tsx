import '../styles/gp-shield.css'

/** One decorative GP mark for every score display. Values carry accessible text. */
export function GPShield({ className = '' }: { className?: string }) {
  return <img className={`gp-shield-icon ${className}`.trim()} src="/ui/gp-shield.png" alt="" aria-hidden="true" />
}
