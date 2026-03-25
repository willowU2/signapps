'use client'

import { ReactNode, useRef } from 'react'
import { Loader2 } from 'lucide-react'
import { useInfiniteScroll } from '@/hooks/use-infinite-scroll'
import { cn } from '@/lib/utils'

export interface InfiniteScrollListProps {
  onLoadMore: () => void
  hasMore: boolean
  isLoading: boolean
  children: ReactNode
  className?: string
  threshold?: number
  endMessage?: string
}

export function InfiniteScrollList({
  onLoadMore,
  hasMore,
  isLoading,
  children,
  className,
  threshold = 200,
  endMessage = 'Tous les éléments ont été chargés.',
}: InfiniteScrollListProps) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)

  const { sentinelRef } = useInfiniteScroll({
    hasMore,
    isLoading,
    onLoadMore,
    threshold,
    root: scrollContainerRef.current,
  })

  return (
    <div ref={scrollContainerRef} className={cn('overflow-y-auto', className)}>
      {children}
      <div ref={sentinelRef} aria-hidden="true" className="h-px" />
      {isLoading && (
        <div className="flex items-center justify-center py-4 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          <span className="text-sm">Chargement...</span>
        </div>
      )}
      {!hasMore && !isLoading && (
        <div className="flex items-center justify-center py-4 text-muted-foreground">
          <span className="text-sm">{endMessage}</span>
        </div>
      )}
    </div>
  )
}
