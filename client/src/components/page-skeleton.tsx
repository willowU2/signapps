import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

interface Props {
  cards?: number;
  rows?: number;
}

export function PageSkeleton({ cards = 3, rows = 5 }: Props) {
  return (
    <div className="space-y-6 p-6">
      <div className="flex gap-4">
        {Array.from({ length: cards }).map((_, i) => (
          <Card key={i} className="flex-1">
            <CardHeader>
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="pt-6 space-y-3">
          {Array.from({ length: rows }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
