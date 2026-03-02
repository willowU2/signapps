"use client"

import { SlideEditor } from "./slide-editor"
import { SlideSidebar } from "./slide-sidebar"
import { useSlides, SlideData } from "./use-slides"
import { useState, useRef, useEffect } from "react"
import { ChevronRight, FileText, Bot, FileImage, Image as ImageIcon, Box, Type, Square, MessageSquare, Save, Download, Undo, Redo, X, Eye, EyeOff, MonitorPlay, Share } from "lucide-react"
import { toast } from "sonner"

// =====================================================================
// MENU BAR COMPONENT (Slides)
// =====================================================================
function MenuBar({ slideState }: { slideState: any }) {
    const [openMenu, setOpenMenu] = useState<string | null>(null)
    const menuRef = useRef<HTMLDivElement>(null)

    // Close menu on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setOpenMenu(null)
            }
        }
        document.addEventListener('click', handleClickOutside)
        return () => document.removeEventListener('click', handleClickOutside)
    }, [])

    type MenuItem = { label?: string, action?: string, icon?: React.ReactNode, shortcut?: string, sep?: boolean, disabled?: boolean, subItems?: MenuItem[] };
    type MenuGroup = { id: string, label: string, items: MenuItem[] };

    const menus: MenuGroup[] = [
        {
            id: 'file', label: 'Fichier', items: [
                { label: 'Nouveau', subItems: [
                    { label: 'Pr\u00E9sentation', action: 'todo', icon: <FileText className="w-4 h-4" /> },
                    { label: 'De mod\u00E8le', action: 'todo' }
                ]},
                { label: 'Ouvrir', action: 'todo', shortcut: 'Ctrl+O' },
                { label: 'Importer des diapositives', action: 'todo' },
                { label: 'Cr\u00E9er une copie', subItems: [
                    { label: 'Toute la pr\u00E9sentation', action: 'todo' },
                    { label: 'Certaines diapositives', action: 'todo' }
                ]},
                { sep: true },
                { label: 'Partager', subItems: [
                    { label: 'Partager avec d\'autres personnes', action: 'todo' },
                    { label: 'Publier sur le Web', action: 'todo' }
                ]},
                { label: 'Envoyer par e-mail', action: 'todo' },
                { label: 'T\u00E9l\u00E9charger', subItems: [
                    { label: 'Microsoft PowerPoint (.pptx)', action: 'todo' },
                    { label: 'Format OpenDocument (.odp)', action: 'todo' },
                    { label: 'Document PDF (.pdf)', action: 'todo' },
                    { label: 'Fichier texte brut (.txt)', action: 'todo' },
                    { label: 'Image JPEG (.jpg)', action: 'todo' },
                    { label: 'Image PNG (.png)', action: 'todo' },
                    { label: 'Graphiques vectoriels \u00E9volutifs (.svg)', action: 'todo' }
                ]},
                { label: 'Convertir en vid\u00E9o', action: 'todo' },
                { sep: true },
                { label: 'Renommer', action: 'todo' },
                { label: 'D\u00E9placer', action: 'todo' },
                { label: 'Ajouter un raccourci dans Drive', action: 'todo' },
                { label: 'Placer dans la corbeille', action: 'todo' },
                { sep: true },
                { label: 'Historique des versions', action: 'todo' },
                { label: 'Rendre disponible hors connexion', action: 'todo' },
                { sep: true },
                { label: 'D\u00E9tails', action: 'todo' },
                { label: 'Limites de s\u00E9curit\u00E9', action: 'todo' },
                { label: 'Langue', action: 'todo' },
                { label: 'Configuration de la page', action: 'todo' },
                { label: 'Imprimer', action: 'todo', shortcut: 'Ctrl+P' }
            ]
        },
        {
            id: 'edit', label: '\u00C9dition', items: [
                { label: 'Annuler', icon: <Undo className="w-4 h-4" />, action: 'undo', shortcut: 'Ctrl+Z', disabled: !slideState.canUndo },
                { label: 'R\u00E9tablir', icon: <Redo className="w-4 h-4" />, action: 'redo', shortcut: 'Ctrl+Y', disabled: !slideState.canRedo },
                { sep: true },
                { label: 'Couper', icon: <X className="w-4 h-4" />, action: 'cut', shortcut: 'Ctrl+X' },
                { label: 'Copier', action: 'copy', shortcut: 'Ctrl+C' },
                { label: 'Coller', action: 'paste', shortcut: 'Ctrl+V' },
                { label: 'Coller sans la mise en forme', action: 'pasteText', shortcut: 'Ctrl+Maj+V' },
                { label: 'Dupliquer', action: 'duplicateObject', shortcut: 'Ctrl+D' },
                { sep: true },
                { label: 'Tout s\u00E9lectionner', action: 'selectAll', shortcut: 'Ctrl+A' },
                { label: 'Ne rien s\u00E9lectionner', action: 'deselectAll' },
                { label: 'Supprimer', action: 'delete' },
                { sep: true },
                { label: 'Rechercher et remplacer', action: 'todo', shortcut: 'Ctrl+H' }
            ]
        },
        {
            id: 'view', label: 'Affichage', items: [
                { label: 'Diaporama', action: 'todo', shortcut: 'Ctrl+F5' },
                { label: 'Animations', action: 'todo', shortcut: 'Ctrl+Alt+Maj+B' },
                { label: 'G\u00E9n\u00E9rateur de th\u00E8me', action: 'todo' },
                { label: 'Mode Grille', action: 'todo', shortcut: 'Ctrl+Alt+1' },
                { sep: true },
                { label: 'Afficher la r\u00E8gle', action: 'todo' },
                { label: 'Guides', subItems: [
                    { label: 'Afficher les guides', action: 'todo' },
                    { label: 'Ajouter un guide vertical', action: 'todo' },
                    { label: 'Ajouter un guide horizontal', action: 'todo' },
                    { label: 'Effacer les guides', action: 'todo' }
                ]},
                { label: 'Aligner sur', subItems: [
                    { label: 'Grille', action: 'todo' },
                    { label: 'Guides', action: 'todo' }
                ]},
                { sep: true },
                { label: 'Afficher les commentaires du pr\u00E9sentateur', action: 'todo' },
                { label: 'Afficher la pellicule', action: 'todo' },
                { sep: true },
                { label: 'Plein \u00E9cran', action: 'todo' }
            ]
        },
        {
            id: 'insert', label: 'Insertion', items: [
                { label: 'Image', icon: <ImageIcon className="w-4 h-4" />, action: 'insertImage', subItems: [
                    { label: 'Importer depuis l\'ordinateur', action: 'insertImage' },
                    { label: 'Rechercher sur le Web', action: 'todo' },
                    { label: 'Drive s\u00E9curis\u00E9', action: 'todo' },
                    { label: 'Photos', action: 'todo' },
                    { label: 'À partir d\'une URL', action: 'todo' },
                    { label: 'Appareil photo', action: 'todo' }
                ]},
                { label: 'Zone de texte', icon: <Type className="w-4 h-4" />, action: 'insertText' },
                { label: 'Audio', action: 'todo' },
                { label: 'Vid\u00E9o', action: 'todo' },
                { label: 'Forme', icon: <Square className="w-4 h-4" />, subItems: [
                    { label: 'Formes', action: 'todo' },
                    { label: 'Flèches', action: 'todo' },
                    { label: 'Légendes', action: 'todo' },
                    { label: 'Équations', action: 'todo' }
                ]},
                { label: 'Tableau', action: 'todo' },
                { label: 'Graphique', subItems: [
                    { label: 'Barres', action: 'todo' },
                    { label: 'Colonnes', action: 'todo' },
                    { label: 'Lignes', action: 'todo' },
                    { label: 'Secteurs', action: 'todo' },
                    { label: 'À partir de Sheets', action: 'todo' }
                ]},
                { label: 'Diagramme', action: 'todo' },
                { label: 'Word Art', action: 'todo' },
                { label: 'Trait', subItems: [
                    { label: 'Ligne', action: 'todo' },
                    { label: 'Flèche', action: 'todo' },
                    { label: 'Curve', action: 'todo' }
                ]},
                { sep: true },
                { label: 'Caract\u00E8res sp\u00E9ciaux', action: 'todo' },
                { label: 'Animation', action: 'todo' },
                { sep: true },
                { label: 'Lien', action: 'todo', shortcut: 'Ctrl+K' },
                { label: 'Commentaire', icon: <MessageSquare className="w-4 h-4" />, action: 'todo', shortcut: 'Ctrl+Alt+M' },
                { sep: true },
                { label: 'Nouvelle diapositive', action: 'addSlide', shortcut: 'Ctrl+M' },
                { label: 'Num\u00E9ros de diapositives', action: 'todo' }
            ]
        },
        {
            id: 'format', label: 'Format', items: [
                { label: 'Texte', subItems: [
                    { label: 'Gras', action: 'bold', shortcut: 'Ctrl+B' },
                    { label: 'Italique', action: 'italic', shortcut: 'Ctrl+I' },
                    { label: 'Soulign\u00E9', action: 'underline', shortcut: 'Ctrl+U' },
                    { label: 'Barr\u00E9', action: 'todo', shortcut: 'Alt+Maj+5' },
                    { label: 'Exposant', action: 'todo', shortcut: 'Ctrl+.' },
                    { label: 'Indice', action: 'todo', shortcut: 'Ctrl+,' }
                ]},
                { label: 'Aligner et r\u00E9tracter', subItems: [
                    { label: 'Gauche', action: 'todo', shortcut: 'Ctrl+Maj+L' },
                    { label: 'Centrer', action: 'todo', shortcut: 'Ctrl+Maj+E' },
                    { label: 'Droite', action: 'todo', shortcut: 'Ctrl+Maj+R' },
                    { label: 'Justifier', action: 'todo', shortcut: 'Ctrl+Maj+J' }
                ]},
                { label: 'Interligne', action: 'todo' },
                { label: 'Puces et num\u00E9ros', subItems: [
                    { label: 'Liste num\u00E9rot\u00E9e', action: 'todo', shortcut: 'Ctrl+Maj+7' },
                    { label: 'Liste \u00E0 puces', action: 'todo', shortcut: 'Ctrl+Maj+8' }
                ]},
                { sep: true },
                { label: 'Bordures et lignes', subItems: [
                    { label: 'Couleur de la bordure', action: 'todo' },
                    { label: 'Épaisseur', action: 'todo' },
                    { label: 'Style', action: 'todo' }
                ]},
                { label: 'Options de mise en forme', action: 'todo' },
                { sep: true },
                { label: 'Effacer la mise en forme', action: 'todo', shortcut: 'Ctrl+\\' }
            ]
        },
        {
            id: 'slide', label: 'Diapositive', items: [
                { label: 'Nouvelle diapositive', action: 'addSlide', shortcut: 'Ctrl+M' },
                { label: 'Dupliquer la diapositive', action: 'duplicateSlide', disabled: !slideState.activeSlideId },
                { label: 'Supprimer la diapositive', action: 'deleteSlide', disabled: !slideState.activeSlideId },
                { label: 'Masquer la diapositive', action: 'todo' },
                { sep: true },
                { label: 'Modifier l\'arri\u00E8re-plan', action: 'changeBackground' },
                { label: 'Appliquer une mise en page', subItems: [
                    { label: 'Vide', action: 'todo' },
                    { label: 'Titre uniquement', action: 'todo' },
                    { label: 'Titre et corps', action: 'todo' }
                ]},
                { label: 'Transition', action: 'todo' },
                { sep: true },
                { label: 'Modifier le th\u00E8me', action: 'todo' },
                { label: 'G\u00E9n\u00E9rer un th\u00E8me IA', icon: <Bot className="w-4 h-4" />, action: 'todo' }
            ]
        },
        {
            id: 'arrange', label: 'R\u00E9organiser', items: [
                { label: 'Ordre', subItems: [
                    { label: 'Mettre au premier plan', action: 'todo', shortcut: 'Ctrl+Maj+\u2191' },
                    { label: 'Avancer', action: 'todo', shortcut: 'Ctrl+\u2191' },
                    { label: 'Reculer', action: 'todo', shortcut: 'Ctrl+\u2193' },
                    { label: 'Mettre en arri\u00E8re-plan', action: 'todo', shortcut: 'Ctrl+Maj+\u2193' }
                ]},
                { label: 'Aligner', subItems: [
                    { label: 'Gauche', action: 'todo' },
                    { label: 'Centre', action: 'todo' },
                    { label: 'Droite', action: 'todo' },
                    { label: 'Haut', action: 'todo' },
                    { label: 'Milieu', action: 'todo' },
                    { label: 'Bas', action: 'todo' }
                ]},
                { label: 'Centrer sur la page', subItems: [
                    { label: 'Horizontalement', action: 'todo' },
                    { label: 'Verticalement', action: 'todo' }
                ]},
                { sep: true },
                { label: 'Associer', action: 'todo', shortcut: 'Ctrl+Alt+G' },
                { label: 'Dissocier', action: 'todo', shortcut: 'Ctrl+Alt+Maj+G' }
            ]
        },
        {
            id: 'tools', label: 'Outils', items: [
                { label: 'Orthographe', subItems: [
                    { label: 'Verification orthographique', action: 'todo' },
                    { label: 'Dictionnaire personnel', action: 'todo' }
                ] },
                { label: 'Rechercher', action: 'todo' },
                { label: 'Objets li\u00E9s', action: 'todo' },
                { label: 'Dictionnaire', action: 'todo', shortcut: 'Ctrl+Maj+Y' },
                { sep: true },
                { label: 'Historique des questions et r\u00E9ponses', action: 'todo' },
                { label: 'Saisie vocale des commentaires du pr\u00E9sentateur', action: 'todo', shortcut: 'Ctrl+Maj+S' },
                { sep: true },
                { label: 'G\u00E9n\u00E9rer des notes IA', icon: <Bot className="w-4 h-4" />, action: 'todo' },
                { label: 'Pr\u00E9f\u00E9rences', action: 'todo' },
                { label: 'Param\u00E8tres d\'accessibilit\u00E9', action: 'todo' }
            ]
        },
        {
            id: 'help', label: 'Aide', items: [
                { label: 'Aide Slides', action: 'todo' },
                { label: 'Formation', action: 'todo' },
                { label: 'Mises \u00E0 jour', action: 'todo' },
                { sep: true },
                { label: 'Aidez-nous \u00E0 am\u00E9liorer Slides', action: 'todo' },
                { label: 'Signaler un abus', action: 'todo' },
                { sep: true },
                { label: 'Raccourcis clavier', action: 'todo', shortcut: 'Ctrl+/' }
            ]
        }
    ]

    const handleMenuAction = (action?: string) => {
        setOpenMenu(null)
        if (!action || action === 'todo') return

        if (action === 'undo') slideState.undo?.()
        if (action === 'redo') slideState.redo?.()
        if (action === 'addSlide') slideState.addSlide()
        if (action === 'duplicateSlide' && slideState.activeSlideId) {
            slideState.duplicateSlide(slideState.activeSlideId)
        }
        if (action === 'deleteSlide' && slideState.activeSlideId) {
            slideState.removeSlide(slideState.activeSlideId)
        }
        if (action === 'changeBackground' && slideState.activeSlideId) {
            const newColor = prompt("Enter a background color (e.g. #ff0000 or red):", "#ffffff")
            if (newColor) {
                slideState.updateSlide(slideState.activeSlideId, { background: newColor })
            }
        }
        if (['bold', 'italic', 'underline'].includes(action)) {
            toast.info("Select text in a block to apply formatting.")
        }
        if (action === 'insertImage') {
            toast.info("Image insertion dialog will open here.")
        }
        if (action === 'insertText') {
            slideState.addObject?.(slideState.activeSlideId, {
                type: 'text',
                content: 'New Text Box',
                position: { x: 100, y: 100 },
                size: { width: 300, height: 100 },
                style: { fontSize: 24 }
            })
        }
    }

    const renderMenuItems = (items: MenuItem[]) => {
        return items.map((item, idx) => {
            if (item.sep) return <div key={idx} className="h-px bg-gray-200 my-1 mx-2" />
            
            const isDisabled = item.disabled === true;
            
            if (item.subItems) {
                return (
                    <div key={idx} className={`relative group px-4 py-1.5 text-sm hover:bg-gray-100 flex items-center justify-between cursor-pointer ${isDisabled ? 'opacity-50 pointer-events-none' : ''}`}>
                        <div className="flex items-center gap-2">
                            {item.icon && <span className="text-gray-500 w-4 h-4">{item.icon}</span>}
                            <span>{item.label}</span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                        
                        {/* Submenu Dropdown */}
                        <div className="absolute left-full top-0 ml-0.5 bg-white border border-gray-200 shadow-lg rounded-md min-w-[200px] py-1 hidden group-hover:block z-50">
                            {renderMenuItems(item.subItems)}
                        </div>
                    </div>
                )
            }
            return (
                <div key={idx} className={`px-4 py-1.5 text-sm hover:bg-gray-100 flex items-center justify-between cursor-pointer ${isDisabled ? 'opacity-50 pointer-events-none' : ''}`} onClick={(e) => { e.stopPropagation(); handleMenuAction(item.action); }}>
                    <div className="flex items-center gap-2">
                        {item.icon ? <span className="text-gray-500 w-4 h-4">{item.icon}</span> : <span className="w-4 h-4" />}
                        <span>{item.label}</span>
                    </div>
                    {item.shortcut && <span className="text-xs text-gray-400 ml-4">{item.shortcut}</span>}
                </div>
            )
        })
    }

    return (
        <div className="text-sm flex mt-0.5 relative z-50" ref={menuRef}>
            {menus.map((menu) => (
                <div key={menu.id} className="relative">
                    <button
                        className={`text-[13px] px-2 py-[3px] rounded-sm font-normal text-[#444746] dark:text-[#9aa0a6] hover:bg-[#f1f3f4] dark:hover:bg-[#303134] transition-colors ${openMenu === menu.id ? 'bg-[#f1f3f4] dark:bg-[#303134] text-[#1f1f1f] dark:text-[#e8eaed]' : ''}`}
                        onClick={() => setOpenMenu(openMenu === menu.id ? null : menu.id)}
                    >
                        {menu.label}
                    </button>
                    {openMenu === menu.id && (
                        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 shadow-lg rounded-md min-w-[220px] py-1 animate-in fade-in zoom-in-95 duration-100">
                            {renderMenuItems(menu.items)}
                        </div>
                    )}
                </div>
            ))}
        </div>
    )
}

export function SlidesContent() {
    const slideState = useSlides("demo-presentation-1")
    const activeSlide = slideState.slides.find(s => s.id === slideState.activeSlideId)

    const [localTitle, setLocalTitle] = useState(activeSlide?.title || "Présentation sans titre")

    useEffect(() => {
        if (activeSlide?.title) setLocalTitle(activeSlide.title)
    }, [activeSlide?.title])

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] font-sans">
            {/* Toolbar / Header */}
            <div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-background border-b border-transparent">
                <div className="flex items-start gap-3">
                    {/* Logo Box (Mimics Google Slides yellow presentation icon) */}
                    <div className="w-10 h-10 mt-1 bg-[#fbbc04] rounded flex items-center justify-center font-bold text-xl text-white shadow-sm shrink-0">
                        S
                    </div>

                    <div className="flex flex-col gap-0.5 mt-0.5">
                        <div className="flex items-center gap-2">
                            <input
                                value={localTitle}
                                onChange={(e) => setLocalTitle(e.target.value)}
                                className="h-6 text-[18px] font-medium border border-transparent hover:border-[#dadce0] focus-visible:ring-2 focus-visible:ring-[#1a73e8] px-1 py-0 w-[250px] bg-transparent shadow-none outline-none text-[#202124] dark:text-[#e8eaed] rounded-sm transition-colors"
                            />
                            <div className="flex -ml-1">
                                <button className="h-6 w-6 rounded-full flex items-center justify-center text-[#5f6368] hover:text-[#202124] hover:bg-[#f1f3f4] transition-colors">
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
                                </button>
                            </div>
                        </div>
                        {/* Menu Bar immediately below title */}
                        <div className="-ml-1.5 mt-0.5">
                            <MenuBar slideState={slideState} />
                        </div>
                    </div>
                </div>

                {/* Right Actions */}
                <div className="flex items-center gap-3 ml-4">
                    <button className="h-9 w-9 rounded-full flex items-center justify-center text-[#5f6368] hover:bg-[#f1f3f4] dark:text-[#9aa0a6] dark:hover:bg-[#303134]">
                        <MessageSquare className="h-5 w-5" />
                    </button>
                    
                    <button className="flex items-center gap-2 px-6 h-9 rounded-full bg-white border border-[#747775] text-[#1f1f1f] hover:bg-[#f8f9fa] font-medium text-sm transition-colors shadow-none">
                        <MonitorPlay className="w-4 h-4" /> {/* Need to add this icon import */}
                        Diaporama
                    </button>

                    <button className="flex items-center gap-2 bg-[#c2e7ff] hover:bg-[#a8d3f1] text-[#001d35] font-medium rounded-full px-6 h-9 transition-colors shadow-none text-sm dark:bg-[#004a77] dark:text-[#c2e7ff] dark:hover:bg-[#005a92]">
                        <Share className="h-4 w-4" />
                        Partager
                    </button>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden bg-[#f8f9fa] dark:bg-[#1f1f1f] relative">
                {/* Sidebar (Slides List) */}
                <div className="w-48 border-r border-gray-200 bg-white/50 z-20">
                    <SlideSidebar
                        slides={slideState.slides}
                        activeSlideId={slideState.activeSlideId}
                        onSelectSlide={slideState.setActiveSlideId}
                        onAddSlide={slideState.addSlide}
                        onRemoveSlide={slideState.removeSlide}
                    />
                </div>

                {/* Main Canvas Area */}
                <div className="flex-1 flex flex-col items-center justify-center p-4 lg:p-8 min-w-0">
                    {slideState.activeSlideId ? (
                        <SlideEditor slideState={slideState} />
                    ) : (
                        <div className="text-gray-400 text-sm">Create a slide to start editing</div>
                    )}
                </div>
            </div>
        </div>
    )
}
