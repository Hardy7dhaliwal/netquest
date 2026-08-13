import type { ComponentType, SVGProps } from "react";

export type DeviceKind = "pc" | "switch" | "router";

export function PcIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" viewBox="0 0 24 24" {...props}>
      <rect height="11" rx="1.5" width="17" x="3.5" y="5" />
      <path d="M8.5 19.5h7M12 16v3.5" />
      <rect height="1.5" rx="0.5" width="8" x="8" y="8" />
    </svg>
  );
}

export function SwitchIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" viewBox="0 0 24 24" {...props}>
      <rect height="13" rx="2" width="18" x="3" y="5.5" />
      <path d="M4 8.5h16" />
      <circle cx="7.5" cy="12" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="11" cy="12" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="12" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="18" cy="12" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="7" cy="6.8" r="0.9" fill="#34d399" stroke="none" />
      <circle cx="9.5" cy="6.8" r="0.9" fill="#34d399" stroke="none" />
    </svg>
  );
}

export function RouterIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" viewBox="0 0 24 24" {...props}>
      <circle cx="12" cy="12" r="7" />
      <path d="M8.5 12h7M12 8.5v7" />
      <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />
      <path d="M4 4.5h4M5.5 3v3M16 4.5h4M17.5 3v3" />
    </svg>
  );
}

export function PacketIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.4" viewBox="0 0 24 24" {...props}>
      <rect height="13" rx="2.5" width="18" x="3" y="5.5" />
      <path d="M4.5 8.5 12 13l7.5-4.5" />
      <circle cx="12" cy="12.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export const DEVICE_ICONS: Record<DeviceKind, ComponentType<SVGProps<SVGSVGElement>>> = {
  pc: PcIcon,
  switch: SwitchIcon,
  router: RouterIcon,
};
