/// <reference types="vite/client" />

declare module "lucide-react" {
  import type { ComponentType, SVGProps } from "react";

  export type LucideIcon = ComponentType<SVGProps<SVGSVGElement> & { size?: number | string }>;
  export const Activity: LucideIcon;
  export const ArrowLeft: LucideIcon;
  export const ArrowRight: LucideIcon;
  export const BarChart3: LucideIcon;
  export const Bell: LucideIcon;
  export const CalendarDays: LucideIcon;
  export const CheckCircle2: LucideIcon;
  export const ChevronRight: LucideIcon;
  export const CircleDollarSign: LucideIcon;
  export const Copy: LucideIcon;
  export const Clock: LucideIcon;
  export const Download: LucideIcon;
  export const ExternalLink: LucideIcon;
  export const FileText: LucideIcon;
  export const Filter: LucideIcon;
  export const Flame: LucideIcon;
  export const GalleryHorizontal: LucideIcon;
  export const Hand: LucideIcon;
  export const Heart: LucideIcon;
  export const ImagePlus: LucideIcon;
  export const LifeBuoy: LucideIcon;
  export const Lock: LucideIcon;
  export const Mail: LucideIcon;
  export const MapPin: LucideIcon;
  export const Medal: LucideIcon;
  export const Minus: LucideIcon;
  export const MessageCircle: LucideIcon;
  export const Moon: LucideIcon;
  export const Plus: LucideIcon;
  export const Printer: LucideIcon;
  export const Radio: LucideIcon;
  export const RefreshCw: LucideIcon;
  export const Search: LucideIcon;
  export const Send: LucideIcon;
  export const Settings: LucideIcon;
  export const Share2: LucideIcon;
  export const ShieldCheck: LucideIcon;
  export const Smartphone: LucideIcon;
  export const Sun: LucideIcon;
  export const Trophy: LucideIcon;
  export const Upload: LucideIcon;
  export const UserPlus: LucideIcon;
  export const Users: LucideIcon;
  export const X: LucideIcon;
  export const Zap: LucideIcon;
  export const ZoomIn: LucideIcon;
}
