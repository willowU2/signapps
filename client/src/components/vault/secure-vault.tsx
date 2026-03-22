'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Lock, Download, Plus } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

type Category = 'RH' | 'Juridique' | 'Finance' | 'Direction';
type AccessLevel = 'Privé' | 'Équipe' | 'Public';

interface Document {
  id: string;
  name: string;
  category: Category;
  uploadDate: Date;
  accessLevel: AccessLevel;
}

interface SecureVaultProps {
  documents?: Document[];
  onUpload?: (file: File, category: Category, accessLevel: AccessLevel) => void;
}

const CATEGORIES: Category[] = ['RH', 'Juridique', 'Finance', 'Direction'];
const ACCESS_LEVELS: AccessLevel[] = ['Privé', 'Équipe', 'Public'];

const getCategoryColor = (category: Category) => {
  const colors: Record<Category, string> = {
    RH: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    Juridique: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    Finance: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    Direction: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  };
  return colors[category];
};

const getAccessLevelColor = (level: AccessLevel) => {
  const colors: Record<AccessLevel, string> = {
    Privé: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    Équipe: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    Public: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  };
  return colors[level];
};

export function SecureVault({
  documents = [],
  onUpload,
}: SecureVaultProps) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category>('RH');
  const [selectedAccessLevel, setSelectedAccessLevel] = useState<AccessLevel>('Privé');
  const [fileName, setFileName] = useState('');

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFileName(e.target.files[0].name);
    }
  };

  const handleUpload = () => {
    const fileInput = document.getElementById('file-input') as HTMLInputElement;
    if (!fileInput?.files?.[0]) {
      toast.error('Veuillez sélectionner un fichier');
      return;
    }

    onUpload?.(fileInput.files[0], selectedCategory, selectedAccessLevel);
    setUploadOpen(false);
    setFileName('');
    setSelectedCategory('RH');
    setSelectedAccessLevel('Privé');
    toast.success('Document téléversé avec succès');
  };

  const handleDownload = (doc: Document) => {
    toast.success(`Téléchargement de ${doc.name}`);
  };

  return (
    <div className="space-y-6">
      {/* Header with Upload Button */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Coffre-Fort Documents</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gérez vos documents confidentiels en toute sécurité
          </p>
        </div>
        <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Ajouter Document
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Téléverser un Document</DialogTitle>
              <DialogDescription>
                Sélectionnez le fichier et définissez les paramètres de sécurité
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Fichier</label>
                <Input
                  id="file-input"
                  type="file"
                  onChange={handleFileSelect}
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Catégorie</label>
                <Select value={selectedCategory} onValueChange={(v) => setSelectedCategory(v as Category)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium">Niveau d'Accès</label>
                <Select value={selectedAccessLevel} onValueChange={(v) => setSelectedAccessLevel(v as AccessLevel)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACCESS_LEVELS.map((level) => (
                      <SelectItem key={level} value={level}>
                        {level}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={handleUpload} className="w-full">
                Téléverser
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Documents List */}
      <div className="grid gap-4">
        {documents.length === 0 ? (
          <div className="text-center py-12 border border-dashed rounded-lg">
            <Lock className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground">Aucun document. Commencez par en ajouter un.</p>
          </div>
        ) : (
          documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition"
            >
              <div className="flex items-center gap-4 flex-1">
                <Lock className="h-5 w-5 text-primary flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="font-medium text-sm">{doc.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {format(doc.uploadDate, 'd MMMM yyyy', { locale: fr })}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Badge className={getCategoryColor(doc.category)}>
                  {doc.category}
                </Badge>
                <Badge className={getAccessLevelColor(doc.accessLevel)}>
                  {doc.accessLevel}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDownload(doc)}
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
