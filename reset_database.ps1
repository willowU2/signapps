Write-Host "=============================="
Write-Host "!! ATTENTION !!"
Write-Host "Cette action va purger INTEGRALEMENT la base de données locale SignApps."
Write-Host "Les 20 schémas, toutes les tables et toutes les données de test vont disparaître !"
Write-Host "=============================="
$response = Read-Host "Souhaitez-vous continuer ? (o/n)"

if ($response -eq 'o' -or $response -eq 'O' -or $response -eq 'oui' -or $response -eq 'y') {
    Write-Host ""
    Write-Host "[x] Suppression de tous les schémas en cours..."
    node client/wipe_db.js
    Write-Host "[x] Succès ! Redémarrez vos microservices pour lancer les migrations vierges."
} else {
    Write-Host "Opération annulée. Aucune donnée n'a été modifiée."
}
