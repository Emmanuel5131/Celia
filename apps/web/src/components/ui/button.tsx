import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import * as React from 'react';
import { cn } from '@/utils/Cn';

/**
 * Actions are pills with a 1.5px ink border. One primary per view; a row of buttons shares one height (docs/DESIGN.md §6).
 * Heights come from the control tokens, so a button, an input and a select in the same row always line up.
 */
const buttonVariants = cva(
  'group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-full border-[1.5px] text-base font-bold whitespace-nowrap transition-colors duration-150 ease-out outline-none select-none focus-ring disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'border-ink bg-ink text-on-ink hover:border-ink-hover hover:bg-ink-hover',
        outline:
          'border-ink bg-surface text-ink hover:bg-ink hover:text-on-ink aria-expanded:bg-ink aria-expanded:text-on-ink',
        secondary: 'border-transparent bg-paper text-ink hover:bg-paper-sunken',
        // A faint tint of the ink on hover and a deeper one while pressed: no warm fill, and the label never moves.
        ghost:
          'border-transparent bg-transparent text-ink hover:bg-ink/6 active:bg-ink/10 aria-expanded:bg-ink/6',
        destructive: 'border-seal bg-surface text-seal hover:bg-seal hover:text-on-ink',
        link: 'h-auto rounded-none border-transparent px-0 text-ink underline underline-offset-4 hover:text-ink-muted',
      },
      size: {
        sm: "h-(--control-sm) px-4 text-sm [&_svg:not([class*='size-'])]:size-4",
        default: "h-(--control-md) px-6 [&_svg:not([class*='size-'])]:size-5",
        lg: "h-(--control-lg) px-8 [&_svg:not([class*='size-'])]:size-5",
        'icon-sm': "size-(--control-sm) [&_svg:not([class*='size-'])]:size-4",
        icon: "size-(--control-md) [&_svg:not([class*='size-'])]:size-5",
        'icon-lg': "size-(--control-lg) [&_svg:not([class*='size-'])]:size-6",
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : 'button';

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
