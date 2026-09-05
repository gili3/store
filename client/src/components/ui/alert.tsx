import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { CheckCircle2, AlertTriangle, Info, XCircle } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * ✅ إعادة تصميم: كان لدى Alert نوعان فقط (default/destructive) بألوان
 * محايدة تقريباً. الآن أربعة أنواع دلالية واضحة (نجاح/خطأ/تحذير/معلومات)
 * بألوان خلفية وحدود ونص مخصصة لكل نوع، حواف أكثر استدارة، وأيقونة
 * افتراضية تلقائية لكل نوع إن لم يُمرَّر عنصر svg يدوياً — نفس الهوية
 * المستخدمة في رسائل Toast (lib/colors.ts → semantic).
 */
const alertVariants = cva(
  "relative w-full rounded-xl border px-4 py-3.5 text-sm grid has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] grid-cols-[0_1fr] has-[>svg]:gap-x-3 gap-y-0.5 items-start shadow-sm [&>svg]:size-5 [&>svg]:translate-y-0.5 [&>svg]:text-current",
  {
    variants: {
      variant: {
        default: "bg-card text-card-foreground border-border",
        destructive:
          "bg-[#FEE2E2] text-[#991B1B] border-[#FECACA] *:data-[slot=alert-description]:text-[#991B1B]/90",
        success:
          "bg-[#DCFCE7] text-[#166534] border-[#BBF7D0] *:data-[slot=alert-description]:text-[#166534]/90",
        warning:
          "bg-[#FFEDD5] text-[#9A3412] border-[#FED7AA] *:data-[slot=alert-description]:text-[#9A3412]/90",
        info:
          "bg-[#DBEAFE] text-[#1E3A8A] border-[#BFDBFE] *:data-[slot=alert-description]:text-[#1E3A8A]/90",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

const DEFAULT_ICONS = {
  default: null,
  destructive: XCircle,
  success: CheckCircle2,
  warning: AlertTriangle,
  info: Info,
} as const;

function Alert({
  className,
  variant,
  children,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  const hasExplicitIcon = React.Children.toArray(children).some(
    (child) => React.isValidElement(child) && child.type !== AlertTitle && child.type !== AlertDescription
  );
  const DefaultIcon = variant ? DEFAULT_ICONS[variant] : null;

  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    >
      {!hasExplicitIcon && DefaultIcon ? <DefaultIcon /> : null}
      {children}
    </div>
  );
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        "col-start-2 line-clamp-1 min-h-4 font-semibold tracking-tight",
        className
      )}
      {...props}
    />
  );
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "text-muted-foreground col-start-2 grid justify-items-start gap-1 text-sm [&_p]:leading-relaxed",
        className
      )}
      {...props}
    />
  );
}

export { Alert, AlertTitle, AlertDescription };
