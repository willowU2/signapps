"use client"

import { useState, useCallback } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { AppLayout } from "@/components/layout/app-layout"
import { Button } from "@/components/ui/button"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CalendarX, Clock, Check, X, AlertTriangle } from "lucide-react"
import { reservationsApi, Reservation, getReservationStatusColor, getReservationStatusLabel } from "@/lib/api/resources"
import { toast } from "sonner"
import { usePageTitle } from '@/hooks/use-page-title';

export default function MyReservationsPage() {
  usePageTitle('Mes reservations');
    const queryClient = useQueryClient()

    const { data: reservations = [], isLoading: loading } = useQuery<Reservation[]>({
        queryKey: ['my-reservations'],
        queryFn: async () => {
            const response = await reservationsApi.listMine()
            return response.data
        },
    })

    const fetchMyReservations = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: ['my-reservations'] })
    }, [queryClient])

    const handleCancel = async (id: string) => {
        try {
            await reservationsApi.cancel(id)
            queryClient.setQueryData<Reservation[]>(['my-reservations'], (prev = []) =>
                prev.map(r => r.id === id ? { ...r, status: "cancelled" as const } : r)
            )
        } catch (error) {
            console.error("Failed to cancel reservation:", error)
            toast.error("Erreur lors de l'annulation de la réservation")
        }
    }

    const pendingReservations = reservations.filter(r => r.status === "pending")
    const approvedReservations = reservations.filter(r => r.status === "approved")
    const pastReservations = reservations.filter(r => r.status === "rejected" || r.status === "cancelled")

    const getStatusIcon = (status: Reservation["status"]) => {
        switch (status) {
            case "pending": return <Clock className="h-4 w-4" />
            case "approved": return <Check className="h-4 w-4" />
            case "rejected": return <X className="h-4 w-4" />
            case "cancelled": return <CalendarX className="h-4 w-4" />
            default: return null
        }
    }

    const ReservationTable = ({ items, showActions = false }: { items: Reservation[], showActions?: boolean }) => (
        <div className="rounded-md border overflow-x-auto">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Ressource</TableHead>
                        <TableHead>Date de demande</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Notes</TableHead>
                        {showActions && <TableHead className="w-[100px]">Actions</TableHead>}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {items.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={showActions ? 5 : 4} className="text-center py-8 text-muted-foreground">
                                Aucune réservation
                            </TableCell>
                        </TableRow>
                    ) : (
                        items.map((reservation) => (
                            <TableRow key={reservation.id}>
                                <TableCell className="font-medium">
                                    {reservation.resource_id.slice(0, 8)}...
                                </TableCell>
                                <TableCell>
                                    {new Date(reservation.created_at).toLocaleDateString("fr-FR", {
                                        day: "numeric",
                                        month: "long",
                                        year: "numeric",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                    })}
                                </TableCell>
                                <TableCell>
                                    <Badge className={getReservationStatusColor(reservation.status)}>
                                        <span className="mr-1">{getStatusIcon(reservation.status)}</span>
                                        {getReservationStatusLabel(reservation.status)}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-muted-foreground max-w-[200px] truncate">
                                    {reservation.notes || "-"}
                                    {reservation.rejection_reason && (
                                        <span className="block text-destructive text-xs">
                                            Motif: {reservation.rejection_reason}
                                        </span>
                                    )}
                                </TableCell>
                                {showActions && (
                                    <TableCell>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="outline" size="sm">
                                                    Annuler
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Annuler la réservation ?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        Cette action est irréversible. La réservation sera annulée et la ressource redeviendra disponible.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Non, garder</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleCancel(reservation.id)}>
                                                        Oui, annuler
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </TableCell>
                                )}
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </div>
    )

    return (
        <AppLayout>
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Mes réservations</h1>
                    <p className="text-muted-foreground mt-1">
                        Gérez vos demandes de réservation de ressources.
                    </p>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="text-muted-foreground">Chargement...</div>
                    </div>
                ) : (
                    <>
                        {/* Summary cards */}
                        <div className="grid gap-4 md:grid-cols-3">
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardDescription>En attente</CardDescription>
                                    <CardTitle className="text-2xl flex items-center gap-2">
                                        <Clock className="h-5 w-5 text-yellow-500" />
                                        {pendingReservations.length}
                                    </CardTitle>
                                </CardHeader>
                            </Card>
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardDescription>Approuvées</CardDescription>
                                    <CardTitle className="text-2xl flex items-center gap-2">
                                        <Check className="h-5 w-5 text-green-500" />
                                        {approvedReservations.length}
                                    </CardTitle>
                                </CardHeader>
                            </Card>
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardDescription>Refusées / Annulées</CardDescription>
                                    <CardTitle className="text-2xl flex items-center gap-2">
                                        <AlertTriangle className="h-5 w-5 text-muted-foreground" />
                                        {pastReservations.length}
                                    </CardTitle>
                                </CardHeader>
                            </Card>
                        </div>

                        <Tabs defaultValue="pending" className="space-y-4">
                            <TabsList>
                                <TabsTrigger value="pending" className="relative">
                                    En attente
                                    {pendingReservations.length > 0 && (
                                        <Badge variant="secondary" className="ml-2">
                                            {pendingReservations.length}
                                        </Badge>
                                    )}
                                </TabsTrigger>
                                <TabsTrigger value="approved">
                                    Approuvées
                                    {approvedReservations.length > 0 && (
                                        <Badge variant="secondary" className="ml-2">
                                            {approvedReservations.length}
                                        </Badge>
                                    )}
                                </TabsTrigger>
                                <TabsTrigger value="history">Historique</TabsTrigger>
                            </TabsList>

                            <TabsContent value="pending">
                                {pendingReservations.length === 0 ? (
                                    <Card>
                                        <CardContent className="flex flex-col items-center justify-center py-12">
                                            <Clock className="h-12 w-12 text-muted-foreground mb-4" />
                                            <CardTitle className="text-lg">Aucune demande en attente</CardTitle>
                                            <CardDescription>
                                                Vos nouvelles demandes de réservation apparaîtront ici.
                                            </CardDescription>
                                        </CardContent>
                                    </Card>
                                ) : (
                                    <ReservationTable items={pendingReservations} showActions />
                                )}
                            </TabsContent>

                            <TabsContent value="approved">
                                {approvedReservations.length === 0 ? (
                                    <Card>
                                        <CardContent className="flex flex-col items-center justify-center py-12">
                                            <Check className="h-12 w-12 text-muted-foreground mb-4" />
                                            <CardTitle className="text-lg">Aucune réservation active</CardTitle>
                                            <CardDescription>
                                                Vos réservations approuvées apparaîtront ici.
                                            </CardDescription>
                                        </CardContent>
                                    </Card>
                                ) : (
                                    <ReservationTable items={approvedReservations} showActions />
                                )}
                            </TabsContent>

                            <TabsContent value="history">
                                {pastReservations.length === 0 ? (
                                    <Card>
                                        <CardContent className="flex flex-col items-center justify-center py-12">
                                            <CalendarX className="h-12 w-12 text-muted-foreground mb-4" />
                                            <CardTitle className="text-lg">Aucun historique</CardTitle>
                                            <CardDescription>
                                                Les réservations passées apparaîtront ici.
                                            </CardDescription>
                                        </CardContent>
                                    </Card>
                                ) : (
                                    <ReservationTable items={pastReservations} />
                                )}
                            </TabsContent>
                        </Tabs>
                    </>
                )}
            </div>
        </AppLayout>
    )
}
