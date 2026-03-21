const fs = require('fs');

const file = 'c:/Users/etien/OneDrive/Bureau/signapps/client/src/app/settings/profile/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add import
content = content.replace(
    `import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';`,
    `import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';\nimport { FileUploadProgressBar } from '@/components/application/file-upload/file-upload-progress-bar';`
);

// 2. Add functions
content = content.replace(
    `const [copiedCodes, setCopiedCodes] = useState(false);`,
    `const [copiedCodes, setCopiedCodes] = useState(false);
  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false);
  
  const handleAvatarUploadStrategy = async (
    id: string,
    file: File,
    onProgress: (progress: number) => void,
    onSuccess: () => void,
    onError: (error: string) => void
  ) => {
    try {
      onProgress(10);
      const reader = new FileReader();
      reader.onload = (event) => {
          const img = new Image();
          img.onload = () => {
              onProgress(50);
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
              const MAX_SIZE = 256;
              let width = img.width;
              let height = img.height;

              if (width > height) {
                  if (width > MAX_SIZE) {
                      height *= MAX_SIZE / width;
                      width = MAX_SIZE;
                  }
              } else {
                  if (height > MAX_SIZE) {
                      width *= MAX_SIZE / height;
                      height = MAX_SIZE;
                  }
              }

              canvas.width = width;
              canvas.height = height;
              ctx.drawImage(img, 0, 0, width, height);

              const dataUrl = canvas.toDataURL('image/webp', 0.8);
              setAvatarUrl(dataUrl);
              onProgress(100);
              onSuccess();
              setAvatarDialogOpen(false);
          };
          img.onerror = () => onError("Failed to load image");
          img.src = event.target?.result as string;
      };
      reader.onerror = () => onError("Failed to read file");
      reader.readAsDataURL(file);
    } catch (err) {
      onError((err as Error).message);
    }
  };`
);

// 3. Replace click handler
content = content.replace(
    `onClick={() => document.getElementById('profile-avatar-upload')?.click()}`,
    `onClick={() => setAvatarDialogOpen(true)}`
);

// 4. Replace input with dialog
content = content.replace(
    /<input[\s\S]*?id="profile-avatar-upload"[\s\S]*?\/>/,
    `<Dialog open={avatarDialogOpen} onOpenChange={setAvatarDialogOpen}>
                  <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                      <DialogTitle>Update Profile Picture</DialogTitle>
                      <DialogDescription>
                        Upload a new image for your avatar
                      </DialogDescription>
                    </DialogHeader>
                    <div className="py-2">
                      <FileUploadProgressBar 
                        customUploadStrategy={handleAvatarUploadStrategy}
                        acceptedTypes="image/*"
                      />
                    </div>
                  </DialogContent>
                </Dialog>`
);

fs.writeFileSync(file, content, 'utf8');
console.log('Profile file updated successfully!');
