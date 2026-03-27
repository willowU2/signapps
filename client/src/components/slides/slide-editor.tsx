import { useRef, useState, useCallback, useEffect } from "react"
import { Wand2 } from "lucide-react"
import * as fabric from "fabric"
import { useSlides } from "./use-slides"
import { SlideToolbar } from "./slide-toolbar"
import { SlideCanvas } from "./slide-canvas"
import { SlidePropertyPanel } from "./slide-property-panel"
import { SpeakerNotesPanel } from "./speaker-notes-panel"
import { Ruler } from '../docs/ruler'
import { DocumentOutline } from '../docs/document-outline'
import { OmniboxMenu } from "./omnibox-menu"
import { CursorOverlay } from "./cursor-overlay"
import { aiApi } from "@/lib/api"
import { useAiRouting } from "@/hooks/use-ai-routing"
import { toast } from "sonner"
import { useSimulatedMultiplayer } from "@/hooks/use-simulated-multiplayer"
import { EditorMenu } from "../editor/editor-menu"
import { GenericFeatureModal } from "@/components/editor/generic-feature-modal"
import pptxgen from "pptxgenjs"

import type { SlideLayout, PresentationTheme, SlideTransitionData } from "./use-slides"
import type { SlideTheme } from "./slide-themes"
import {
    AnimationPanel,
    type ObjectAnimationConfig,
    type SlideTransition,
    type EntranceAnimation,
    type ExitAnimation,
} from "./slide-animations"
import { TransitionPicker } from "./transition-picker"
import {
    MasterSlideEditor,
    DEFAULT_MASTERS,
    type MasterSlide,
} from "./master-slide-editor"
import {
    LivePresenterView,
    generatePresentationId,
} from "./live-presentation"
import {
    performAutoLayout,
    extractCanvasObjectInfo,
} from "./ai-layout"

// Fabric object with custom id property used throughout
interface FabricObjectWithId extends fabric.Object {
    id?: string;
    isEditing?: boolean;
    text?: string;
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: string | number;
    fontStyle?: string;
    underline?: boolean;
    linethrough?: boolean;
    textAlign?: string;
    getObjects?: () => FabricObjectWithId[];
}

interface CopiedTextFormat {
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: string | number;
    fontStyle?: string;
    fill?: string | fabric.Pattern | fabric.Gradient<'linear'> | fabric.Gradient<'radial'> | null;
    underline?: boolean;
    linethrough?: boolean;
    textAlign?: string;
}

// Let's create an interface matching the `useSlides` return type conceptually
interface SlideEditorProps {
    slideState: {
        objects: Record<string, fabric.Object>;
        updateObject: (id: string, obj: fabric.Object | Record<string, unknown>) => void;
        removeObject: (id: string) => void;
        updateCursor: (x: number, y: number) => void;
        collaborators: Record<number, { user: { name: string; color: string }; cursor?: { x: number; y: number; slideId: string } }>;
        isConnected: boolean;
        activeSlideId: string | null;
        canUndo: boolean;
        canRedo: boolean;
        undo: () => void;
        redo: () => void;
        clearSlide: () => void;
        updateSlideNotes?: (id: string, notes: string) => void;
        getSlideNotes?: (id: string) => string;
        updateSlideLayout?: (id: string, layout: SlideLayout) => void;
        getSlideLayout?: (id: string) => SlideLayout;
        presentationTheme?: PresentationTheme;
        updatePresentationTheme?: (theme: Partial<PresentationTheme>) => void;
        addSlide?: (layout?: SlideLayout) => void;
        // Transitions
        updateSlideTransition?: (id: string, transition: SlideTransitionData) => void;
        getSlideTransition?: (id: string) => SlideTransitionData;
        // Master slides
        updateSlideMaster?: (id: string, masterId: string) => void;
        getSlideMaster?: (id: string) => string | undefined;
        // Export helpers for live presentation
        slides?: Array<{ id: string; title: string; notes?: string; transition?: SlideTransitionData }>;
        getSlideObjects?: (slideId: string) => Record<string, fabric.Object>;
        getAllSlidesWithObjects?: () => Array<{ id: string; objects: Record<string, any> | fabric.Object[] }>;
    }
    isReadOnly?: boolean;
}

export function SlideEditor({ slideState, isReadOnly = false }: SlideEditorProps) {
    const {
        objects, updateObject, removeObject, updateCursor, collaborators, isConnected, activeSlideId,
        canUndo, canRedo, undo, redo, clearSlide, updateSlideNotes, getSlideNotes,
        updateSlideLayout, getSlideLayout, presentationTheme, updatePresentationTheme, addSlide,
        updateSlideTransition, getSlideTransition,
        updateSlideMaster, getSlideMaster,
        slides: allSlides, getSlideObjects, getAllSlidesWithObjects
    } = slideState;

    const fabricCanvasRef = useRef<fabric.Canvas | null>(null)
    const isUpdatingRef = useRef(false)
    const [activeObject, setActiveObject] = useState<fabric.Object | null>(null)
    const [omniboxMenu, setOmniboxMenu] = useState({ isOpen: false, x: 0, y: 0 })
    const [activeModal, setActiveModal] = useState<{ id: string, label?: string } | null>(null)

    const { getRouteConfig } = useAiRouting()

    // Editor UI Config State
    const [showGrid, setShowGrid] = useState(true)
    const [snapToGrid, setSnapToGrid] = useState(false)

    // --- Format Painter State ---
    const [isFormatPainting, setIsFormatPainting] = useState(false)
    const [copiedFormat, setCopiedFormat] = useState<CopiedTextFormat | null>(null)

    const [isListening, setIsListening] = useState(false)
    const recognitionRef = useRef<any>(null)

    // --- Page Setup State ---
    const [pageConfig, setPageConfig] = useState<{ orientation: 'portrait' | 'landscape', backgroundColor: string }>({ orientation: 'portrait', backgroundColor: '#ffffff' })

    // --- Feature States: Animations, Master Slides, Live Presentation ---
    const [showAnimationPanel, setShowAnimationPanel] = useState(false)
    const [showMasterEditor, setShowMasterEditor] = useState(false)
    const [masterSlides, setMasterSlides] = useState<MasterSlide[]>(DEFAULT_MASTERS)
    const [livePresentation, setLivePresentation] = useState<{ active: boolean; id: string } | null>(null)
    const [animationConfig, setAnimationConfig] = useState<ObjectAnimationConfig>({
        entranceType: 'none',
        exitType: 'none',
        duration: 500,
        delay: 0,
    })

    // Global keyboard shortcuts
    useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey || e.metaKey) {
                const key = e.key.toLowerCase();
                if (key === 's') { e.preventDefault(); toast.success('Enregistré automatiquement'); }
                else if (key === 'n') { e.preventDefault(); window.open('/slides', '_blank'); }
                else if (key === 'o') { e.preventDefault(); toast.info("Rendez-vous sur l'accueil Drive pour ouvrir un fichier."); }
                else if (key === 'q') { e.preventDefault(); toast.info("Fermez l'onglet du navigateur pour quitter la session."); }
                else if (key === 'a') {
                    const tag = (e.target as HTMLElement).tagName.toLowerCase();
                    if (tag !== 'input' && tag !== 'textarea') {
                        e.preventDefault();
                        const canvas = fabricCanvasRef.current;
                        if (canvas) {
                            canvas.discardActiveObject();
                            const objs = canvas.getObjects();
                            if (objs.length > 0) {
                                import("fabric").then((fabricModule) => {
                                    const sel = new fabricModule.ActiveSelection(objs, { canvas });
                                    canvas.setActiveObject(sel);
                                    canvas.requestRenderAll();
                                });
                            }
                        }
                    }
                }
            }
        };
        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, []);

    const slideMenus = [
        {
            id: 'file', label: 'Fichier', items: [
                { label: 'Nouveau', subItems: [
                    { label: 'Présentation', action: 'new' },
                    { label: 'À partir d\'un modèle', action: 'slides_templates' }
                ] },
                { label: 'Ouvrir', action: 'open', shortcut: 'Ctrl+O' },
                { label: 'Importer des diapositives', action: 'slides_import' },
                { label: 'Créer une copie', action: 'slides_copy' },
                { sep: true },
                { label: 'Télécharger', subItems: [
                    { label: 'Microsoft PowerPoint (.pptx)', action: 'export_pptx' },
                    { label: 'Document PDF (.pdf)', action: 'export_pdf' },
                    { label: 'Image PNG (.png)', action: 'export' }
                ] },
                { sep: true },
                { label: 'Paramètres mis en page', subItems: [
                    { label: 'Portrait', action: 'pageSetup_portrait' },
                    { label: 'Paysage', action: 'pageSetup_landscape' }
                ] },
                { sep: true },
                { label: 'Historique des versions', action: 'slides_versions' },
                { label: 'Détails du fichier', action: 'slides_details' }
            ]
        },
        {
            id: 'edit', label: 'Édition', items: [
                { label: 'Annuler', action: 'undo', shortcut: 'Ctrl+Z' },
                { label: 'Rétablir', action: 'redo', shortcut: 'Ctrl+Y' },
                { sep: true },
                { label: 'Couper', action: 'cut', shortcut: 'Ctrl+X' },
                { label: 'Copier', action: 'copy', shortcut: 'Ctrl+C' },
                { label: 'Coller', action: 'paste', shortcut: 'Ctrl+V' },
                { label: 'Supprimer', action: 'delete' },
                { sep: true },
                { label: 'Tout sélectionner', action: 'selectAll', shortcut: 'Ctrl+A' },
                { label: 'Effacer la page', action: 'clear' },
                { sep: true },
                { label: 'Rechercher et remplacer', action: 'slides_find_replace' }
            ]
        },
        {
            id: 'view', label: 'Affichage', items: [
                { label: 'Diaporama', action: 'fullScreen', shortcut: 'Ctrl+F5' },
                { label: 'Mode présentateur', action: 'slides_presenter_mode' },
                { sep: true },
                { label: 'Afficher la grille', action: 'toggleGrid' },
                { label: 'Aligner sur la grille', action: 'toggleSnap' },
                { label: 'Afficher les guides', action: 'toggleGuides' },
                { label: 'Afficher la règle', action: 'toggleRuler' },
                { sep: true },
                { label: 'Zoom', subItems: [
                    { label: '50%', action: 'zoom50' },
                    { label: '75%', action: 'zoom75' },
                    { label: '100%', action: 'zoom100' },
                    { label: '150%', action: 'zoom150' },
                    { label: '200%', action: 'zoom200' },
                    { label: 'Ajuster à la fenêtre', action: 'zoomFit' }
                ] },
                { sep: true },
                { label: 'Mode animation', action: 'slides_animation_mode' },
                { label: 'Commentaires', action: 'slides_comments' }
            ]
        },
        {
            id: 'insert', label: 'Insertion', items: [
                { label: 'Texte', action: 'addText', shortcut: 'T' },
                { label: 'Zone de texte', action: 'addTextbox' },
                { label: 'Forme', subItems: [
                    { label: 'Rectangle', action: 'addShapeRect' },
                    { label: 'Rectangle arrondi', action: 'addShapeRoundedRect' },
                    { label: 'Cercle', action: 'addShapeCircle' },
                    { label: 'Ellipse', action: 'addShapeEllipse' },
                    { label: 'Triangle', action: 'addShapeTriangle' },
                    { label: 'Étoile', action: 'addShapeStar' },
                    { label: 'Flèche', action: 'addShapeArrow' },
                    { label: 'Bulle de dialogue', action: 'addShapeBubble' }
                ] },
                { label: 'Ligne', subItems: [
                    { label: 'Ligne droite', action: 'addShapeLine' },
                    { label: 'Flèche', action: 'addLineArrow' },
                    { label: 'Connecteur coudé', action: 'addLineElbow' },
                    { label: 'Connecteur courbe', action: 'addLineCurve' }
                ] },
                { sep: true },
                { label: 'Image', subItems: [
                    { label: 'Importer depuis l\'ordinateur', action: 'slides_insert_image_local' },
                    { label: 'Importer depuis une URL', action: 'slides_insert_image_url' },
                    { label: 'Rechercher sur le Web', action: 'slides_insert_image_search' },
                    { label: 'Depuis Google Drive', action: 'slides_insert_image_drive' }
                ] },
                { label: 'Vidéo', action: 'slides_insert_video' },
                { label: 'Audio', action: 'slides_insert_audio' },
                { sep: true },
                { label: 'Tableau', action: 'slides_insert_table' },
                { label: 'Graphique', action: 'slides_insert_chart' },
                { label: 'Diagramme', action: 'slides_insert_diagram' },
                { label: 'WordArt', action: 'slides_insert_wordart' },
                { sep: true },
                { label: 'Mise en page AI', action: 'addMagicLayout' },
                { label: 'Smart Chips', subItems: [
                    { label: 'Utilisateur', action: 'addChipUser' },
                    { label: 'Date', action: 'addChipDate' },
                    { label: 'Fichier', action: 'addChipFile' },
                    { label: 'Statut', action: 'addChipStatus' }
                ] },
                { label: 'Blocs interactifs', subItems: [
                    { label: 'Signature électronique', action: 'addWorkflowSignature' },
                    { label: 'Brouillon email', action: 'addWorkflowEmail' },
                    { label: 'Notes de réunion', action: 'addWorkflowMeeting' },
                    { label: 'Tableau', action: 'addTableBlock' }
                ] },
                { sep: true },
                { label: 'Nouvelle diapositive', action: 'addSlide', shortcut: 'Ctrl+M' },
                { label: 'Dupliquer la diapositive', action: 'duplicateSlide' },
                { label: 'Numéro de diapositive', action: 'slides_insert_slide_number' }
            ]
        },
        {
            id: 'format', label: 'Format', items: [
                { label: 'Reproduire la mise en forme', action: 'toggleFormatPainter' },
                { sep: true },
                { label: 'Texte', subItems: [
                    { label: 'Gras', action: 'textBold', shortcut: 'Ctrl+B' },
                    { label: 'Italique', action: 'textItalic', shortcut: 'Ctrl+I' },
                    { label: 'Souligné', action: 'textUnderline', shortcut: 'Ctrl+U' },
                    { label: 'Barré', action: 'textStrikethrough' },
                    { sep: true },
                    { label: 'Exposant', action: 'textSuperscript' },
                    { label: 'Indice', action: 'textSubscript' },
                    { sep: true },
                    { label: 'Taille de police', action: 'slides_font_size' },
                    { label: 'Couleur du texte', action: 'slides_text_color' },
                    { label: 'Surlignage', action: 'slides_text_highlight' }
                ] },
                { label: 'Alignement', subItems: [
                    { label: 'Aligner à gauche', action: 'alignLeft' },
                    { label: 'Centrer', action: 'alignCenter' },
                    { label: 'Aligner à droite', action: 'alignRight' },
                    { label: 'Justifier', action: 'alignJustify' }
                ] },
                { label: 'Espacement', subItems: [
                    { label: 'Interligne simple', action: 'lineSpacingSingle' },
                    { label: 'Interligne 1,5', action: 'lineSpacing1_5' },
                    { label: 'Interligne double', action: 'lineSpacingDouble' }
                ] },
                { sep: true },
                { label: 'Arranger', subItems: [
                    { label: 'Premier plan', action: 'bringToFront', shortcut: 'Ctrl+Maj+Up' },
                    { label: 'Vers l\'avant', action: 'bringForward' },
                    { label: 'Vers l\'arrière', action: 'sendBackward' },
                    { label: 'Arrière plan', action: 'sendToBack', shortcut: 'Ctrl+Maj+Down' }
                ] },
                { label: 'Aligner les objets', subItems: [
                    { label: 'Aligner à gauche', action: 'objectAlignLeft' },
                    { label: 'Centrer horizontalement', action: 'objectAlignCenterH' },
                    { label: 'Aligner à droite', action: 'objectAlignRight' },
                    { label: 'Aligner en haut', action: 'objectAlignTop' },
                    { label: 'Centrer verticalement', action: 'objectAlignCenterV' },
                    { label: 'Aligner en bas', action: 'objectAlignBottom' }
                ] },
                { label: 'Distribuer', subItems: [
                    { label: 'Distribuer horizontalement', action: 'distributeH' },
                    { label: 'Distribuer verticalement', action: 'distributeV' }
                ] },
                { sep: true },
                { label: 'Grouper', action: 'groupItems', shortcut: 'Ctrl+G' },
                { label: 'Dégrouper', action: 'ungroupItems', shortcut: 'Ctrl+Maj+G' },
                { sep: true },
                { label: 'Bordures et lignes', action: 'slides_borders' },
                { label: 'Options de forme', action: 'slides_shape_options' },
                { label: 'Thème et couleurs', action: 'slides_theme_colors' }
            ]
        },
        {
            id: 'slide', label: 'Diapositive', items: [
                { label: 'Nouvelle diapositive', action: 'addSlide', shortcut: 'Ctrl+M' },
                { label: 'Dupliquer la diapositive', action: 'duplicateSlide' },
                { label: 'Supprimer la diapositive', action: 'deleteSlide' },
                { sep: true },
                { label: 'Modifier le modèle', action: 'slides_edit_master' },
                { label: 'Changer de thème', action: 'slides_change_theme' },
                { label: 'Changer la mise en page', action: 'slides_change_layout' },
                { sep: true },
                { label: 'Arrière-plan', action: 'slides_background' },
                { label: 'Transitions', action: 'slides_transitions' },
                { label: 'Animations', action: 'slides_animations' },
                { sep: true },
                { label: 'Masquer la diapositive', action: 'hideSlide' },
                { label: 'Sauter cette diapositive', action: 'skipSlide' }
            ]
        },
        {
            id: 'tools', label: 'Outils', items: [
                { label: 'Saisie vocale', action: 'toggleListen' },
                { label: 'Orthographe', action: 'slides_spell_check' },
                { sep: true },
                { label: 'Explorer', action: 'slides_explore' },
                { label: 'Dictionnaire', action: 'slides_dictionary' },
                { sep: true },
                { label: 'Q&R en direct', action: 'slides_qa' },
                { label: 'Pointeur laser', action: 'slides_laser_pointer' },
                { sep: true },
                { label: 'Préférences', action: 'slides_preferences' },
                { label: 'Raccourcis clavier', action: 'slides_shortcuts' }
            ]
        },
        {
            id: 'extensions', label: 'Extensions', items: [
                { label: 'Modules complémentaires', action: 'slides_add_ons' },
                { label: 'Apps Script', action: 'slides_apps_script' },
                { sep: true },
                { label: 'IA - Générer du contenu', action: 'ai_generate_content' },
                { label: 'IA - Résumer', action: 'ai_summarize' },
                { label: 'IA - Reformuler', action: 'ai_rephrase' },
                { label: 'IA - Traduire', action: 'ai_translate' }
            ]
        },
        {
            id: 'help', label: 'Aide', items: [
                { label: 'Aide SignApps Slides', action: 'slides_help' },
                { label: 'Guide de démarrage', action: 'slides_getting_started' },
                { label: 'Raccourcis clavier', action: 'slides_shortcuts' },
                { sep: true },
                { label: 'Signaler un problème', action: 'slides_report_issue' },
                { label: 'Envoyer des commentaires', action: 'slides_feedback' }
            ]
        }
    ];

    // --- Simulated Multiplayer Presence ---
    const { collaborators: simCollabs } = useSimulatedMultiplayer(activeSlideId || "doc", true)

    // Merge Yjs true collaborators with our Simulated AI Ghosts
    const mergedCollaborators = { ...collaborators }
    simCollabs.forEach((guest, index) => {
        // Use negative/high IDs for ghosts to avoid collision with real Y.js client IDs
        mergedCollaborators[1000 + index] = {
            user: { name: guest.name, color: guest.color },
            cursor: guest.cursor ? { x: guest.cursor.x, y: guest.cursor.y, slideId: guest.activeSlideId || "doc" } : undefined
        }
    })

    useEffect(() => {
        // Initialize Web Speech API if supported
        const SpeechRecognitionCtor = (window as any).SpeechRecognition
            || (window as any).webkitSpeechRecognition;
        if (SpeechRecognitionCtor) {
            recognitionRef.current = new SpeechRecognitionCtor()
            recognitionRef.current.continuous = true
            recognitionRef.current.interimResults = true
            recognitionRef.current.lang = 'fr-FR' // Set default language to French

            let finalTranscript = ""

            recognitionRef.current.onresult = (event: any) => {
                let interimTranscript = ""
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const transcript = event.results[i][0].transcript
                    if (event.results[i].isFinal) {
                        finalTranscript += transcript + " "
                    } else {
                        interimTranscript += transcript
                    }
                }

                // Update the active object immediately with the recognized text
                const canvas = fabricCanvasRef.current;
                const active = canvas?.getActiveObject() as FabricObjectWithId | null;
                if (active && (active.type === 'i-text' || active.type === 'textbox' || active.type === 'text')) {
                    // We overwrite the whole text if it was empty, or append if it wasn't.
                    // For better UX we just append to existing to avoid wiping work
                    // Note: A smarter implementation would remember where we started dictating,
                    // but appending works well for this building block iteration.
                    // We only append the final parts, and temporarily show interim parts.
                    const newText = (finalTranscript + interimTranscript).trim()

                    // Prevent infinite appending bug by clearing our local tracker on stop
                    active.set({ text: newText } as Partial<fabric.Object>);
                    canvas?.requestRenderAll();
                }
            }

            recognitionRef.current.onerror = (event: any) => {
                console.debug("Speech recognition error", event.error)
                setIsListening(false)
                toast.error("Microphone issue: " + event.error)
            }

            recognitionRef.current.onend = () => {
                setIsListening(false)
            }
        }
    }, [])

    const toggleListen = useCallback(() => {
        if (isListening) {
            recognitionRef.current?.stop()
            setIsListening(false)
        } else {
            const canvas = fabricCanvasRef.current;
            const active = canvas?.getActiveObject();
            if (!active || (active.type !== 'i-text' && active.type !== 'textbox' && active.type !== 'text')) {
                toast.error("Veuillez sélectionner une zone de texte pour dicter.");
                return;
            }

            try {
                recognitionRef.current?.start()
                setIsListening(true)
                toast.info("Microphone activé. Parlez maintenant.")
            } catch (err) {
                console.debug("Could not start speech recognition", err)
            }
        }
    }, [isListening])


    // Clear canvas entirely when the slide ID changes
    useEffect(() => {
        if (fabricCanvasRef.current) {
            fabricCanvasRef.current.clear()
            fabricCanvasRef.current.backgroundColor = "#fff"
            setActiveObject(null)
        }
    }, [activeSlideId])

    // Handle Format Painter
    useEffect(() => {
        const canvas = fabricCanvasRef.current;
        if (!canvas) return;

        const handleSelectionCreated = (e: { selected?: FabricObjectWithId[] }) => {
            if (!isFormatPainting || !copiedFormat || !e.selected || e.selected.length === 0) return;

            const target = e.selected[0];
            // Only apply text formatting to text-like objects
            if (target.type === 'i-text' || target.type === 'textbox' || target.type === 'text') {
                target.set(copiedFormat as Partial<fabric.Object>);
                canvas.requestRenderAll();

                // Sync to Yjs
                isUpdatingRef.current = true;
                updateObject(target.id!, target.toObject());
                isUpdatingRef.current = false;

                // Turn off painter after one use
                setIsFormatPainting(false);
                setCopiedFormat(null);

                toast.success('Format applied');
            }
        };

        canvas.on('selection:created', handleSelectionCreated);
        canvas.on('selection:updated', handleSelectionCreated);

        return () => {
            canvas.off('selection:created', handleSelectionCreated);
            canvas.off('selection:updated', handleSelectionCreated);
        }
    }, [fabricCanvasRef, isFormatPainting, copiedFormat, updateObject])

    // Trigger Format Painter mode
    const toggleFormatPainter = useCallback(() => {
        const canvas = fabricCanvasRef.current;
        if (!canvas) return;

        if (isFormatPainting) {
            // Turning off
            setIsFormatPainting(false);
            setCopiedFormat(null);
            canvas.defaultCursor = 'default';
            canvas.hoverCursor = 'move';
        } else {
            // Turning on: must have a text object selected to copy format from
            const active = canvas.getActiveObject();
            if (!active || (active.type !== 'i-text' && active.type !== 'textbox' && active.type !== 'text')) {
                toast.error("Please select a text object first to copy its format");
                return;
            }

            // Extract core text styling attrs
            const activeText = active as FabricObjectWithId;
            const formatToCopy: CopiedTextFormat = {
                fontFamily: activeText.fontFamily,
                fontSize: activeText.fontSize,
                fontWeight: activeText.fontWeight,
                fontStyle: activeText.fontStyle,
                fill: active.fill,
                underline: activeText.underline,
                linethrough: activeText.linethrough,
                textAlign: activeText.textAlign,
            };

            setCopiedFormat(formatToCopy);
            setIsFormatPainting(true);

            // Visual feedback: change cursor
            canvas.defaultCursor = 'crosshair'; // A substitute for a paintbrush cursor
            canvas.hoverCursor = 'crosshair';

            toast.success("Format copied. Click another text to apply.");
        }
    }, [isFormatPainting]);

    // Clipboard for Fabric objects
    const clipboardRef = useRef<FabricObjectWithId | null>(null);

    // Listen for global keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement
            const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable

            // 1. Omnibox trigger
            if (!isTyping && (e.key === '/' || e.key === '@')) {
                e.preventDefault()
                setOmniboxMenu({ isOpen: true, x: window.innerWidth / 2 - 160, y: window.innerHeight / 2 - 200 })
                return;
            }

            const canvas = fabricCanvasRef.current;
            if (!canvas || isTyping) return;

            // Escape: Deselect all objects or close omnibox
            if (e.key === 'Escape') {
                e.preventDefault();
                if (omniboxMenu.isOpen) {
                    setOmniboxMenu({ isOpen: false, x: 0, y: 0 });
                } else {
                    canvas.discardActiveObject();
                    canvas.requestRenderAll();
                }
                return;
            }

            const activeObject = canvas.getActiveObject() as FabricObjectWithId | null;
            if (!activeObject || activeObject.isEditing) return;

            // 2. Delete object
            if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                isUpdatingRef.current = true;
                if (activeObject.type === 'activeSelection') {
                    const groupItems = activeObject.getObjects?.() ?? [];
                    groupItems.forEach((item) => {
                        canvas.remove(item);
                        if (item.id) removeObject(item.id);
                    });
                    canvas.discardActiveObject();
                } else {
                    canvas.remove(activeObject);
                    if (activeObject.id) removeObject(activeObject.id);
                }
                isUpdatingRef.current = false;
                canvas.requestRenderAll();
                return;
            }

            // 3. Copy (Ctrl+C / Cmd+C)
            if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
                e.preventDefault();
                activeObject.clone().then((cloned: FabricObjectWithId) => {
                    clipboardRef.current = cloned;
                });
                return;
            }

            // 4. Paste (Ctrl+V / Cmd+V)
            if ((e.ctrlKey || e.metaKey) && e.key === 'v' && clipboardRef.current) {
                e.preventDefault();

                // clone again so you can paste multiple times
                clipboardRef.current.clone().then((clonedObj: FabricObjectWithId) => {
                    canvas.discardActiveObject();
                    clonedObj.set({
                        left: (clonedObj.left || 0) + 20,
                        top: (clonedObj.top || 0) + 20,
                        evented: true,
                    });

                    if (clonedObj.type === 'activeSelection') {
                        // active selection needs a loop to add objects individually
                        (clonedObj as FabricObjectWithId & { canvas: fabric.Canvas }).canvas = canvas;
                        clonedObj.getObjects?.().forEach((obj) => {
                            obj.id = Math.random().toString(36).substr(2, 9);
                            canvas.add(obj);
                        });
                        // this should reset the selection to its original position
                        clonedObj.setCoords();
                    } else {
                        clonedObj.id = Math.random().toString(36).substr(2, 9);
                        canvas.add(clonedObj);
                    }
                    if (clipboardRef.current) {
                        clipboardRef.current.top = (clipboardRef.current.top || 0) + 20;
                        clipboardRef.current.left = (clipboardRef.current.left || 0) + 20;
                    }

                    canvas.setActiveObject(clonedObj);
                    canvas.requestRenderAll();

                    // Update state
                    isUpdatingRef.current = true;
                    if (clonedObj.type === 'activeSelection') {
                        clonedObj.getObjects?.().forEach((obj) => { if (obj.id) updateObject(obj.id, obj.toObject()); });
                    } else {
                        if (clonedObj.id) updateObject(clonedObj.id, clonedObj.toObject());
                    }
                    isUpdatingRef.current = false;
                });
                return;
            }

            // 5. Duplicate (Ctrl+D / Cmd+D)
            if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
                e.preventDefault();
                activeObject.clone().then((clonedObj: FabricObjectWithId) => {
                    canvas.discardActiveObject();
                    clonedObj.set({
                        left: (clonedObj.left || 0) + 20,
                        top: (clonedObj.top || 0) + 20,
                        evented: true,
                    });

                    if (clonedObj.type === 'activeSelection') {
                        (clonedObj as FabricObjectWithId & { canvas: fabric.Canvas }).canvas = canvas;
                        clonedObj.getObjects?.().forEach((obj) => {
                            obj.id = Math.random().toString(36).substr(2, 9);
                            canvas.add(obj);
                        });
                        clonedObj.setCoords();
                    } else {
                        clonedObj.id = Math.random().toString(36).substr(2, 9);
                        canvas.add(clonedObj);
                    }

                    canvas.setActiveObject(clonedObj);
                    canvas.requestRenderAll();

                    isUpdatingRef.current = true;
                    if (clonedObj.type === 'activeSelection') {
                        clonedObj.getObjects?.().forEach((obj) => { if (obj.id) updateObject(obj.id, obj.toObject()); });
                    } else {
                        if (clonedObj.id) updateObject(clonedObj.id, clonedObj.toObject());
                    }
                    isUpdatingRef.current = false;
                });
                return;
            }

            // 6. Nudging (Arrows)
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                e.preventDefault();
                const step = e.shiftKey ? 10 : 1;
                let dx = 0; let dy = 0;
                if (e.key === 'ArrowUp') dy = -step;
                if (e.key === 'ArrowDown') dy = step;
                if (e.key === 'ArrowLeft') dx = -step;
                if (e.key === 'ArrowRight') dx = step;

                const objs = activeObject.type === 'activeSelection' ? (activeObject.getObjects?.() ?? [activeObject]) : [activeObject];
                // Move selection box
                activeObject.set({ left: (activeObject.left || 0) + dx, top: (activeObject.top || 0) + dy });
                activeObject.setCoords();

                isUpdatingRef.current = true;
                objs.forEach((obj) => {
                    // Update object inside group correctly handled by Fabric magically, or we trigger full update
                    const objId = obj.id || activeObject.id;
                    if (objId) updateObject(objId, obj.toObject());
                });
                isUpdatingRef.current = false;
                canvas.requestRenderAll();
                return;
            }

            // 7. Cut (Ctrl+X / Cmd+X)
            if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
                e.preventDefault();
                activeObject.clone().then((cloned: FabricObjectWithId) => {
                    clipboardRef.current = cloned;
                    isUpdatingRef.current = true;
                    if (activeObject.type === 'activeSelection') {
                        const groupItems = activeObject.getObjects?.() ?? [];
                        groupItems.forEach((item) => {
                            canvas.remove(item);
                            if (item.id) removeObject(item.id);
                        });
                        canvas.discardActiveObject();
                    } else {
                        canvas.remove(activeObject);
                        if (activeObject.id) removeObject(activeObject.id);
                    }
                    isUpdatingRef.current = false;
                    canvas.requestRenderAll();
                });
                return;
            }

            // 8. Bold (Ctrl+B / Cmd+B) - for text objects
            if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
                e.preventDefault();
                if (activeObject.type === 'i-text' || activeObject.type === 'textbox') {
                    const textObj = activeObject as fabric.IText;
                    const currentWeight = textObj.fontWeight;
                    textObj.set('fontWeight', currentWeight === 'bold' ? 'normal' : 'bold');
                    canvas.requestRenderAll();
                    isUpdatingRef.current = true;
                    if (activeObject.id) updateObject(activeObject.id, activeObject.toObject());
                    isUpdatingRef.current = false;
                }
                return;
            }

            // 9. Italic (Ctrl+I / Cmd+I) - for text objects
            if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
                e.preventDefault();
                if (activeObject.type === 'i-text' || activeObject.type === 'textbox') {
                    const textObj = activeObject as fabric.IText;
                    const currentStyle = textObj.fontStyle;
                    textObj.set('fontStyle', currentStyle === 'italic' ? 'normal' : 'italic');
                    canvas.requestRenderAll();
                    isUpdatingRef.current = true;
                    if (activeObject.id) updateObject(activeObject.id, activeObject.toObject());
                    isUpdatingRef.current = false;
                }
                return;
            }

            // 10. Underline (Ctrl+U / Cmd+U) - for text objects
            if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
                e.preventDefault();
                if (activeObject.type === 'i-text' || activeObject.type === 'textbox') {
                    const textObj = activeObject as fabric.IText;
                    const currentUnderline = textObj.underline;
                    textObj.set('underline', !currentUnderline);
                    canvas.requestRenderAll();
                    isUpdatingRef.current = true;
                    if (activeObject.id) updateObject(activeObject.id, activeObject.toObject());
                    isUpdatingRef.current = false;
                }
                return;
            }
        }

        // Listen context menu / double click on canvas area for mouse-aware positioning
        const handleGlobalClick = (e: MouseEvent) => {
            if (e.button === 2) { // Right click
                // Prevent default context menu elsewhere? Optional.
            }
        }

        window.addEventListener("keydown", handleKeyDown)
        return () => window.removeEventListener("keydown", handleKeyDown)
    }, [omniboxMenu.isOpen, removeObject, updateObject])

    // Define a stable object modification pipeline
    const handleUpdateActiveObject = useCallback((id: string, updates: Record<string, unknown>) => {
        isUpdatingRef.current = true
        // Merge updates with the current object data directly in Yjs via hook
        const currentData = objects[id] || {};
        updateObject(id, { ...currentData, ...updates })
        isUpdatingRef.current = false

        // Force state update to re-render the properties panel
        if (fabricCanvasRef.current) {
            const currentSelected = fabricCanvasRef.current.getActiveObject()
            // We clone merely to trigger React's re-render
            setActiveObject(currentSelected ? Object.assign(Object.create(Object.getPrototypeOf(currentSelected)), currentSelected) : null)
        }
    }, [objects, updateObject])

    const addMagicLayout = async () => {
        const config = getRouteConfig('slides');
        const canvas = fabricCanvasRef.current;
        if (!canvas) return;

        const toastId = toast.loading("✨ AI Generation in progress...");

        try {
            const prompt = "You are a strict JSON generator. Return a JSON array of objects representing a presentation slide layout about 'Q3 Performance Review' containing a title, a subtitle, 3 bullet points, and a placeholder rect for a chart. Each object must have a 'type' ('text' or 'rect'), 'text' (if type is text), 'left', 'top', 'width', 'height', 'fill', 'fontSize', 'fontFamily', 'fontWeight'. Return ONLY valid JSON array with no markdown blocks. Use beautiful colors.";

            const response = await aiApi.chat(prompt, {
                provider: config.providerId || undefined,
                model: config.modelId || undefined,
                systemPrompt: "You are an assistant that outputs strictly raw JSON arrays. Do not wrap in ```json blocks. Generate clean, well-aligned dimensions.",
            });

            // Try to parse the answer as JSON
            let answer = response.data.answer.trim();
            // Clean markdown if present
            if (answer.startsWith("```json")) {
                answer = answer.replace(/^```json/, "").replace(/```$/, "").trim();
            } else if (answer.startsWith("```")) {
                answer = answer.replace(/^```/, "").replace(/```$/, "").trim();
            }

            const layoutData = JSON.parse(answer);

            import("fabric").then((fabricModule) => {
                canvas.getObjects().forEach(obj => canvas.remove(obj));
                canvas.backgroundColor = "#F8F9FA";

                const layoutObjects: FabricObjectWithId[] = [];

                for (const item of layoutData) {
                    let obj: FabricObjectWithId | undefined;
                    if (item.type === 'text') {
                        obj = new fabricModule.IText(item.text || 'Text', {
                            left: item.left || 50,
                            top: item.top || 50,
                            fontFamily: item.fontFamily || "Inter, sans-serif",
                            fontSize: item.fontSize || 20,
                            fill: item.fill || "#000000",
                            fontWeight: item.fontWeight || "normal"
                        }) as FabricObjectWithId;
                    } else if (item.type === 'rect') {
                        obj = new fabricModule.Rect({
                            left: item.left || 50,
                            top: item.top || 50,
                            width: item.width || 100,
                            height: item.height || 100,
                            fill: item.fill || "#818cf8",
                            rx: 8,
                            ry: 8
                        }) as FabricObjectWithId;
                    }
                    if (obj) {
                        obj.id = Math.random().toString(36).substr(2, 9);
                        layoutObjects.push(obj);
                        canvas.add(obj);
                    }
                }

                canvas.requestRenderAll();

                layoutObjects.forEach((obj) => {
                    isUpdatingRef.current = true;
                    if (obj.id) updateObject(obj.id, obj.toObject());
                    isUpdatingRef.current = false;
                });

                toast.success("Magic Layout generated successfully!", { id: toastId });
            });

        } catch (error) {
            console.debug("Layout generation failed", error);
            toast.error("Failed to generate layout. AI model may have returned invalid JSON or provider is unavailable.", { id: toastId });
        }
    };

    const addText = (defaultText: string = "New Text", options: Record<string, unknown> = {}) => {
        import("fabric").then((fabricModule) => {
            const canvas = fabricCanvasRef.current
            if (canvas) {
                const text = new fabricModule.IText(defaultText, {
                    left: 100,
                    top: 100,
                    fontFamily: "Inter, sans-serif",
                    ...options
                })
                canvas.add(text)
                canvas.setActiveObject(text)
            }
        })
    }

    const addShape = (type: 'rect' | 'circle' | 'triangle' | 'line') => {
        import("fabric").then((fabricModule) => {
            const canvas = fabricCanvasRef.current
            if (canvas) {
                let shape: FabricObjectWithId | undefined;
                const defaultOpts = { left: 200, top: 200, fill: '#818cf8' }

                switch (type) {
                    case 'rect':
                        shape = new fabricModule.Rect({ ...defaultOpts, width: 100, height: 100, rx: 8, ry: 8 })
                        break;
                    case 'circle':
                        shape = new fabricModule.Circle({ ...defaultOpts, radius: 50 })
                        break;
                    case 'triangle':
                        shape = new fabricModule.Triangle({ ...defaultOpts, width: 100, height: 100 })
                        break;
                    case 'line':
                        shape = new fabricModule.Line([50, 50, 200, 50], { ...defaultOpts, stroke: '#818cf8', strokeWidth: 4, fill: undefined })
                        break;
                }

                if (shape) {
                    canvas.add(shape)
                    canvas.setActiveObject(shape)
                }
            }
        })
    }

    const addImage = (url: string) => {
        import("fabric").then((fabricModule) => {
            const canvas = fabricCanvasRef.current
            if (canvas) {
                fabricModule.Image.fromURL(url).then((img: import("fabric").Image) => {
                    // Auto-scale huge images to fit into the canvas (800x450 bounds)
                    const maxWidth = 400
                    const maxHeight = 300

                    if (img.width && img.width > maxWidth) {
                        img.scaleToWidth(maxWidth)
                    }
                    if (img.height && img.getScaledHeight() > maxHeight) {
                        img.scaleToHeight(maxHeight)
                    }

                    img.set({
                        left: 200,
                        top: 200,
                        originX: 'center',
                        originY: 'center',
                        rx: 4, // Slight corner rounding for modern look
                        ry: 4
                    })

                    canvas.add(img)
                    canvas.setActiveObject(img)
                }).catch((err: unknown) => {
                    console.debug("Failed to load image:", err)
                    alert("Impossible de charger cette image. Vérifiez que l'URL est publique et que le serveur autorise le CORS.")
                })
            }
        })
    }

    const addSmartChip = (type: 'user' | 'status' | 'date' | 'file', label: string, color?: string) => {
        import("fabric").then((fabricModule) => {
            const canvas = fabricCanvasRef.current
            if (canvas) {
                // Formatting based on type
                let chipColor = color || '#e2e8f0'; // default gray
                let textColor = '#1e293b';
                let icon = '';

                switch (type) {
                    case 'user':
                        chipColor = '#dbeafe'; // light blue
                        textColor = '#1e40af';
                        icon = '👤 ';
                        break;
                    case 'date':
                        chipColor = '#fef3c7'; // light yellow
                        textColor = '#b45309';
                        icon = '📅 ';
                        break;
                    case 'file':
                        chipColor = '#f3e8ff'; // light purple
                        textColor = '#6b21a8';
                        icon = '📄 ';
                        break;
                    case 'status':
                        chipColor = color || '#10b981'; // Green by default
                        textColor = '#ffffff';
                        icon = '';
                        break;
                }

                const displayLabel = icon + label;

                const text = new fabricModule.IText(displayLabel, {
                    fontSize: 14,
                    fontFamily: "Inter, sans-serif",
                    fontWeight: "600",
                    fill: textColor,
                    originX: 'center',
                    originY: 'center',
                    left: 0,
                    top: 0
                })

                // Calculate width based on text
                const paddingX = 20
                const paddingY = 10
                const width = (text.width || 50) + paddingX
                const height = (text.height || 20) + paddingY

                const bg = new fabricModule.Rect({
                    width,
                    height,
                    rx: height / 2,
                    ry: height / 2,
                    fill: chipColor,
                    originX: 'center',
                    originY: 'center',
                    left: 0,
                    top: 0,
                    stroke: type === 'user' ? '#bfdbfe' : undefined, // Subtle border
                    strokeWidth: type === 'user' ? 1 : 0
                })

                const group = new fabricModule.Group([bg, text], {
                    left: 200,
                    top: 200,
                    lockScalingY: true, // Prevent breaking the pill shape
                    // @ts-ignore
                    isSmartChip: true,
                    // @ts-ignore
                    chipType: type
                })

                canvas.add(group)
                canvas.setActiveObject(group)
            }
        })
    }

    const addWorkflow = (type: 'signature' | 'email' | 'meeting') => {
        import("fabric").then((fabricModule) => {
            const canvas = fabricCanvasRef.current
            if (canvas) {
                let groupObjects: fabric.Object[] = []

                // Get center of current view
                const vpt = canvas.viewportTransform;
                const startX = vpt ? (-vpt[4] + canvas.width! / 2) - 200 : 100;
                const startY = vpt ? (-vpt[5] + canvas.height! / 2) - 100 : 100;

                if (type === 'signature') {
                    // --- Premium eSignature Block ---
                    const bg = new fabricModule.Rect({ left: startX, top: startY, width: 340, height: 160, fill: '#ffffff', rx: 12, ry: 12, stroke: '#e2e8f0', strokeWidth: 1, shadow: new fabricModule.Shadow({ color: 'rgba(0,0,0,0.08)', blur: 15, offsetY: 4 }) })

                    const headerBg = new fabricModule.Rect({ left: startX, top: startY, width: 340, height: 42, fill: '#f8fafc', rx: 12, ry: 12 }) // Clip path not possible easily on group, we accept overlap
                    const headerLine = new fabricModule.Line([startX, startY + 42, startX + 340, startY + 42], { stroke: '#e2e8f0', strokeWidth: 1 })

                    const iconBox = new fabricModule.Rect({ left: startX + 16, top: startY + 11, width: 20, height: 20, rx: 4, ry: 4, fill: '#ede9fe' })
                    const title = new fabricModule.IText("🖋️ eSignature Request", { left: startX + 18, top: startY + 13, fontSize: 13, fontFamily: "Inter, sans-serif", fontWeight: "600", fill: '#4f46e5' })

                    const signLabel = new fabricModule.IText("Sign here:", { left: startX + 24, top: startY + 64, fontSize: 12, fontFamily: "Inter, sans-serif", fontWeight: "500", fill: '#64748b' })
                    const signZoneBg = new fabricModule.Rect({ left: startX + 24, top: startY + 84, width: 180, height: 50, fill: '#f1f5f9', rx: 4, ry: 4, stroke: '#cbd5e1', strokeWidth: 1, strokeDashArray: [4, 4] })
                    const signZoneTxt = new fabricModule.IText("Click to sign", { left: startX + 76, top: startY + 102, fontSize: 12, fontFamily: "Inter, sans-serif", fill: '#94a3b8' })

                    const dateLabel = new fabricModule.IText("Date:", { left: startX + 220, top: startY + 64, fontSize: 12, fontFamily: "Inter, sans-serif", fontWeight: "500", fill: '#64748b' })
                    const dateZoneBg = new fabricModule.Rect({ left: startX + 220, top: startY + 84, width: 96, height: 50, fill: '#f8fafc', rx: 4, ry: 4, stroke: '#e2e8f0', strokeWidth: 1 })

                    groupObjects = [bg, headerBg, headerLine, title, signLabel, signZoneBg, signZoneTxt, dateLabel, dateZoneBg]
                }
                else if (type === 'email') {
                    // --- Premium Email Draft Block ---
                    const bg = new fabricModule.Rect({ left: startX, top: startY, width: 440, height: 280, fill: '#ffffff', rx: 12, ry: 12, stroke: '#e2e8f0', strokeWidth: 1, shadow: new fabricModule.Shadow({ color: 'rgba(0,0,0,0.1)', blur: 20, offsetY: 8 }) })

                    const headerBg = new fabricModule.Rect({ left: startX, top: startY, width: 440, height: 48, fill: '#f8fafc' })
                    const title = new fabricModule.IText("✉️ Email Draft", { left: startX + 20, top: startY + 16, fontSize: 14, fontFamily: "Inter, sans-serif", fontWeight: "600", fill: '#0f172a' })

                    // Button Send preview
                    const btnBg = new fabricModule.Rect({ left: startX + 340, top: startY + 12, width: 80, height: 26, fill: '#2563eb', rx: 13, ry: 13 })
                    const btnTxt = new fabricModule.IText("Send", { left: startX + 364, top: startY + 18, fontSize: 12, fontFamily: "Inter, sans-serif", fontWeight: "600", fill: '#ffffff' })

                    const line1 = new fabricModule.Line([startX, startY + 48, startX + 440, startY + 48], { stroke: '#e2e8f0', strokeWidth: 1 })
                    const toLabel = new fabricModule.IText("To:", { left: startX + 20, top: startY + 62, fontSize: 13, fontFamily: "Inter, sans-serif", fontWeight: "500", fill: '#64748b' })

                    // Smart chip simulated for "To"
                    const toChipBg = new fabricModule.Rect({ left: startX + 50, top: startY + 58, width: 140, height: 22, fill: '#eff6ff', rx: 11, ry: 11 })
                    const toChipTxt = new fabricModule.IText("👤 client@company.com", { left: startX + 58, top: startY + 63, fontSize: 11, fontFamily: "Inter, sans-serif", fontWeight: "500", fill: '#1d4ed8' })

                    const line2 = new fabricModule.Line([startX, startY + 90, startX + 440, startY + 90], { stroke: '#f1f5f9', strokeWidth: 1 })
                    const subjLabel = new fabricModule.IText("Subject:", { left: startX + 20, top: startY + 104, fontSize: 13, fontFamily: "Inter, sans-serif", fontWeight: "500", fill: '#64748b' })
                    const subjInput = new fabricModule.IText("Project Proposal Q3", { left: startX + 80, top: startY + 104, fontSize: 13, fontFamily: "Inter, sans-serif", fontWeight: "600", fill: '#0f172a' })

                    const line3 = new fabricModule.Line([startX, startY + 132, startX + 440, startY + 132], { stroke: '#f1f5f9', strokeWidth: 1 })
                    const body = new fabricModule.IText("Hi there,\n\nPlease find attached the latest strategy draft.\n\nBest regards,", { left: startX + 20, top: startY + 150, fontSize: 13, fontFamily: "Inter, sans-serif", fill: '#334155', lineHeight: 1.5 })

                    groupObjects = [bg, headerBg, title, btnBg, btnTxt, line1, toLabel, toChipBg, toChipTxt, line2, subjLabel, subjInput, line3, body]
                }
                else if (type === 'meeting') {
                    // --- Premium Meeting Notes Block ---
                    const bg = new fabricModule.Rect({ left: startX, top: startY, width: 500, height: 220, fill: '#ffffff', rx: 12, ry: 12, stroke: '#e2e8f0', strokeWidth: 1, shadow: new fabricModule.Shadow({ color: 'rgba(0,0,0,0.06)', blur: 12, offsetY: 4 }) })

                    const topBar = new fabricModule.Rect({ left: startX, top: startY, width: 500, height: 6, fill: '#8b5cf6', rx: 12, ry: 12 }) // Top colored accent

                    const title = new fabricModule.IText("📅 Weekly Sync: Product Team", { left: startX + 24, top: startY + 24, fontSize: 16, fontFamily: "Inter, sans-serif", fontWeight: "bold", fill: '#0f172a' })

                    // Date chip
                    const dateChipBg = new fabricModule.Rect({ left: startX + 24, top: startY + 54, width: 90, height: 22, fill: '#fef3c7', rx: 4, ry: 4 })
                    const dateChipTxt = new fabricModule.IText("Oct 24, 2024", { left: startX + 32, top: startY + 59, fontSize: 11, fontFamily: "Inter, sans-serif", fontWeight: "600", fill: '#b45309' })

                    // Attendees
                    const attLabel = new fabricModule.IText("Attendees:", { left: startX + 130, top: startY + 59, fontSize: 12, fontFamily: "Inter, sans-serif", fill: '#64748b' })
                    const att1Bg = new fabricModule.Rect({ left: startX + 196, top: startY + 54, width: 64, height: 22, fill: '#f1f5f9', rx: 11, ry: 11 })
                    const att1Txt = new fabricModule.IText("👤 Alice", { left: startX + 204, top: startY + 59, fontSize: 11, fontFamily: "Inter, sans-serif", fill: '#475569' })
                    const att2Bg = new fabricModule.Rect({ left: startX + 266, top: startY + 54, width: 60, height: 22, fill: '#f1f5f9', rx: 11, ry: 11 })
                    const att2Txt = new fabricModule.IText("👤 Bob", { left: startX + 274, top: startY + 59, fontSize: 11, fontFamily: "Inter, sans-serif", fill: '#475569' })

                    const line = new fabricModule.Line([startX + 24, startY + 90, startX + 476, startY + 90], { stroke: '#f1f5f9', strokeWidth: 1 })

                    const agendaTitle = new fabricModule.IText("Notes & Agenda", { left: startX + 24, top: startY + 110, fontSize: 13, fontFamily: "Inter, sans-serif", fontWeight: "600", fill: '#334155' })
                    const agendaItems = new fabricModule.IText("• Review Q3 Metrics\n• Discussion on onboarding flow", { left: startX + 24, top: startY + 134, fontSize: 13, fontFamily: "Inter, sans-serif", fill: '#475569', lineHeight: 1.5 })

                    const actionTitle = new fabricModule.IText("Action Items", { left: startX + 260, top: startY + 110, fontSize: 13, fontFamily: "Inter, sans-serif", fontWeight: "600", fill: '#334155' })
                    const actionItems = new fabricModule.IText("☐ Update design system (Alice)\n☐ Schedule user interviews (Bob)", { left: startX + 260, top: startY + 134, fontSize: 13, fontFamily: "Inter, sans-serif", fill: '#475569', lineHeight: 1.5 })

                    groupObjects = [bg, topBar, title, dateChipBg, dateChipTxt, attLabel, att1Bg, att1Txt, att2Bg, att2Txt, line, agendaTitle, agendaItems, actionTitle, actionItems]
                }

                if (groupObjects.length > 0) {
                    const group = new fabricModule.Group(groupObjects, {
                        left: startX,
                        top: startY,
                        // @ts-ignore
                        isWorkflowBlock: true,
                        // @ts-ignore
                        workflowType: type
                    })
                    canvas.add(group)
                    canvas.setActiveObject(group)
                }
            }
        })
    }

    const addTable = (rows = 3, cols = 3) => {
        import("fabric").then((fabricModule) => {
            const canvas = fabricCanvasRef.current
            if (canvas) {
                const groupObjects: fabric.Object[] = []

                // Get center of current view
                const vpt = canvas.viewportTransform;
                const startX = vpt ? (-vpt[4] + canvas.width! / 2) - 200 : 100;
                const startY = vpt ? (-vpt[5] + canvas.height! / 2) - 100 : 100;

                const cellWidth = 120;
                const cellHeight = 40;

                // Build header (Row 0)
                for (let c = 0; c < cols; c++) {
                    const bg = new fabricModule.Rect({
                        left: startX + c * cellWidth,
                        top: startY,
                        width: cellWidth,
                        height: cellHeight,
                        fill: '#f1f5f9', // subtle gray header
                        stroke: '#cbd5e1',
                        strokeWidth: 1
                    });
                    const text = new fabricModule.IText(`Col ${c + 1}`, {
                        left: startX + c * cellWidth + 12,
                        top: startY + 12,
                        fontSize: 13,
                        fontFamily: "Inter, sans-serif",
                        fontWeight: "600",
                        fill: '#334155'
                    });
                    groupObjects.push(bg, text);
                }

                // Build body rows
                for (let r = 1; r < rows; r++) {
                    for (let c = 0; c < cols; c++) {
                        const bg = new fabricModule.Rect({
                            left: startX + c * cellWidth,
                            top: startY + r * cellHeight,
                            width: cellWidth,
                            height: cellHeight,
                            fill: '#ffffff',
                            stroke: '#cbd5e1',
                            strokeWidth: 1
                        });
                        const text = new fabricModule.IText("", {
                            left: startX + c * cellWidth + 12,
                            top: startY + r * cellHeight + 12,
                            fontSize: 13,
                            fontFamily: "Inter, sans-serif",
                            fill: '#475569'
                        });

                        // Fake placeholder text if empty cell (for clickability visually mostly)
                        // If we set text to "" it might be hard to click with IText sometimes in a group. 
                        // Actually in a group, the text cannot be double-clicked cleanly without entering group mode.
                        // We will just leave it empty.
                        groupObjects.push(bg, text);
                    }
                }

                if (groupObjects.length > 0) {
                    const group = new fabricModule.Group(groupObjects, {
                        left: startX,
                        top: startY,
                        // @ts-ignore
                        isTableBlock: true,
                        // @ts-ignore
                        subTargetCheck: true // Required for editing items inside a group
                    })
                    canvas.add(group)
                    canvas.setActiveObject(group)
                }
            }
        })
    }

    const exportToPNG = () => {
        const canvas = fabricCanvasRef.current
        if (!canvas) return

        // Export with multiplier 2 for High Resolution (Retina ready)
        const dataURL = canvas.toDataURL({
            format: 'png',
            multiplier: 2
        })

        const link = document.createElement('a')
        link.download = `Slide-Export-${new Date().toISOString().slice(0, 10)}.png`
        link.href = dataURL
        document.body.appendChild(link)
        document.body.removeChild(link)
    }

    const exportToPPTX = () => {
        const canvas = fabricCanvasRef.current
        if (!canvas) return
        
        const pres = new pptxgen()
        const slide = pres.addSlide()
        
        // "Best-effort" PPTX generation
        canvas.getObjects().forEach((obj) => {
             const o = obj as FabricObjectWithId & { scaleX?: number; scaleY?: number; toDataURL?: () => string }
             const scaleX = o.scaleX || 1
             const scaleY = o.scaleY || 1
             const x = (o.left || 0) / 100
             const y = (o.top || 0) / 100
             const w = (o.width || 0) * scaleX / 100
             const h = (o.height || 0) * scaleY / 100
             const fillStr = typeof o.fill === 'string' ? o.fill : undefined

             if (obj.type === 'i-text' || obj.type === 'textbox' || obj.type === 'text') {
                 const textO = o as FabricObjectWithId & { fontSize?: number }
                 slide.addText(o.text || '', { x, y, w, h, fontSize: (textO.fontSize || 18) * scaleY, color: fillStr?.replace('#', '') || '000000' })
             } else if (obj.type === 'rect') {
                 slide.addShape(pres.ShapeType.rect, { x, y, w, h, fill: { color: fillStr?.replace('#', '') || 'CCCCCC' } })
             } else if (obj.type === 'circle') {
                 slide.addShape(pres.ShapeType.ellipse, { x, y, w, h, fill: { color: fillStr?.replace('#', '') || 'CCCCCC' } })
             } else if (obj.type === 'image') {
                 try {
                     const dataUrl = o.toDataURL?.()
                     if (dataUrl) slide.addImage({ data: dataUrl, x, y, w, h })
                 } catch (err) {
                     console.debug("Could not export image to PPTX", err)
                 }
             }
        })
        
        pres.writeFile({ fileName: `Slide-Export-${new Date().toISOString().slice(0, 10)}.pptx` })
        toast.success("Diapositive exportée au format PPTX")
    }

    // --- Read Only Lock ---
    useEffect(() => {
        const canvas = fabricCanvasRef.current;
        if (!canvas) return;
        
        const isInteractive = !isReadOnly;
        canvas.selection = isInteractive;
        canvas.getObjects().forEach(obj => {
            obj.selectable = isInteractive;
            obj.evented = isInteractive;
        });
        canvas.requestRenderAll();
    }, [isReadOnly, objects, activeSlideId]);
    
    // --- Global Command Bar AI Integration ---
    useEffect(() => {
        const handleAiAction = async (e: CustomEvent) => {
            const { action } = e.detail;
            const config = getRouteConfig('slides');

            if (action === 'generate-layout') {
                addMagicLayout();
                return;
            }

            const canvas = fabricCanvasRef.current;
            const active = canvas?.getActiveObject();
            if (!active || (active.type !== 'i-text' && active.type !== 'textbox' && active.type !== 'text')) {
                if (action !== 'generate-layout') {
                    toast.error("Veuillez sélectionner une zone de texte d'abord.");
                }
                return;
            }

            const textObj = active as FabricObjectWithId;
            const currentText = textObj.text || "";
            const toastId = toast.loading("✨ IA en cours de traitement...");

            try {
                let prompt = "";
                let systemPrompt = "";

                if (action === 'simplify-text') {
                    prompt = `Simplifie ce texte pour une présentation courte : "${currentText}"`;
                    systemPrompt = "Tu es un relecteur. Ne retourne QUE le texte corrigé/simplifié, sans guillemets ni intro.";
                } else if (action === 'grammar-check') {
                    prompt = `Corrige les fautes d'orthographe et de grammaire de ce texte : "${currentText}"`;
                    systemPrompt = "Tu es un correcteur orthographique professionnel. Retourne uniquement le texte corrigé.";
                } else if (action === 'translate-en') {
                    prompt = `Traduis précisément ceci en anglais fluide : "${currentText}"`;
                    systemPrompt = "You are a professional translator. Return ONLY the English translation without any surrounding quotes.";
                } else if (action === 'expand-text') {
                    prompt = `Développe cette idée en un paragraphe complet et professionnel : "${currentText}"`;
                    systemPrompt = "Tu es rédacteur. Rédige un bout de texte clair et étoffé. Ne réponds que le texte métier.";
                }

                const response = await aiApi.chat(prompt, {
                    provider: config.providerId || undefined,
                    model: config.modelId || undefined,
                    systemPrompt
                });

                textObj.set({
                    text: response.data.answer.trim(),
                    // Optionally visual feedback:
                    fill: action === 'grammar-check' ? '#10b981' : (action === 'translate-en' ? '#f59e0b' : '#3b82f6')
                });

                canvas?.requestRenderAll();
                updateObject(textObj.id!, textObj.toObject());
                toast.success("Texte mis à jour avec succès !", { id: toastId });

            } catch (err) {
                console.debug("AI Text Action failed", err);
                toast.error("Erreur lors de la génération IA.", { id: toastId });
            }
        };

        window.addEventListener('app:ai-action', handleAiAction as unknown as EventListener);
        return () => window.removeEventListener('app:ai-action', handleAiAction as unknown as EventListener);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [updateObject, getRouteConfig])



    // --- Feature Handlers ---

    const handleAnimationChange = useCallback((config: ObjectAnimationConfig) => {
        setAnimationConfig(config)
        // Store animation data on the selected fabric object
        const canvas = fabricCanvasRef.current
        const active = canvas?.getActiveObject() as FabricObjectWithId & { animationType?: string; animationDuration?: number; animationDelay?: number; animationExit?: string } | null
        if (active && active.id) {
            active.animationType = config.entranceType;
            active.animationDuration = config.duration;
            active.animationDelay = config.delay;
            active.animationExit = config.exitType;
            isUpdatingRef.current = true
            if (active.id) updateObject(active.id, active.toObject())
            isUpdatingRef.current = false
        }
    }, [updateObject])

    const handleAnimationPreview = useCallback(() => {
        const canvas = fabricCanvasRef.current
        const active = canvas?.getActiveObject()
        if (!active) {
            toast.info("Selectionnez un objet pour previsualiser l'animation.")
            return
        }
        // Simple preview: hide then animate in
        const originalOpacity = active.opacity
        const originalLeft = active.left
        const originalTop = active.top
        const originalScaleX = active.scaleX
        const originalScaleY = active.scaleY

        active.set({ opacity: 0 })
        canvas?.requestRenderAll()

        setTimeout(() => {
            active.animate({ opacity: originalOpacity || 1 }, {
                duration: animationConfig.duration,
                onChange: () => canvas?.requestRenderAll(),
                onComplete: () => {
                    active.set({ left: originalLeft, top: originalTop, scaleX: originalScaleX, scaleY: originalScaleY })
                    canvas?.requestRenderAll()
                }
            })
        }, 100)
    }, [animationConfig])

    // Load animation config when selection changes
    useEffect(() => {
        if (activeObject) {
            const obj = activeObject as FabricObjectWithId & { animationType?: string; animationExit?: string; animationDuration?: number; animationDelay?: number }
            setAnimationConfig({
                entranceType: (obj.animationType || 'none') as EntranceAnimation,
                exitType: (obj.animationExit || 'none') as ExitAnimation,
                duration: obj.animationDuration || 500,
                delay: obj.animationDelay || 0,
            })
        }
    }, [activeObject])

    const handleMasterSelect = useCallback((masterId: string) => {
        if (activeSlideId && updateSlideMaster) {
            updateSlideMaster(activeSlideId, masterId)
            toast.success("Modele applique a la diapositive.")
        }
    }, [activeSlideId, updateSlideMaster])

    const handleMasterUpdate = useCallback((master: MasterSlide) => {
        setMasterSlides(prev => prev.map(m => m.id === master.id ? master : m))
        toast.success("Modele mis a jour.")
    }, [])

    const handleMasterAdd = useCallback((master: MasterSlide) => {
        setMasterSlides(prev => [...prev, master])
    }, [])

    const handleMasterDelete = useCallback((masterId: string) => {
        setMasterSlides(prev => prev.filter(m => m.id !== masterId))
    }, [])

    const handleStartLivePresentation = useCallback(() => {
        const id = generatePresentationId()
        setLivePresentation({ active: true, id })
    }, [])

    const handleAutoLayout = useCallback(async () => {
        const canvas = fabricCanvasRef.current
        if (!canvas) return
        const config = getRouteConfig('slides')
        await performAutoLayout(canvas, {
            useAi: true,
            routeConfig: {
                providerId: config.providerId || undefined,
                modelId: config.modelId || undefined,
            },
            animated: true,
        })
        // Sync all objects to Yjs after layout
        const objs = canvas.getObjects()
        isUpdatingRef.current = true
        ;(canvas.getObjects() as FabricObjectWithId[]).forEach((obj) => {
            if (obj.id) updateObject(obj.id, obj.toObject())
        })
        isUpdatingRef.current = false
    }, [updateObject, getRouteConfig])

    // --- Live Presentation View ---
    if (livePresentation?.active && allSlides && getSlideObjects) {
        const slideNodes = allSlides.map((slide) => {
            const slideObjects = getSlideObjects(slide.id)
            return (
                <div key={slide.id} className="w-full h-full bg-white rounded-lg shadow-lg flex items-center justify-center p-8">
                    <div className="text-center space-y-4">
                        <h2 className="text-4xl font-bold text-gray-800">{slide.title}</h2>
                        <p className="text-gray-500">{Object.keys(slideObjects).length} objets</p>
                    </div>
                </div>
            )
        })
        const slideNotes = allSlides.map((s) => s.notes || '')
        const slideTransitions = allSlides.map((s) => s.transition || { type: 'none' as const, duration: 500 })

        return (
            <LivePresenterView
                slides={slideNodes}
                slideNotes={slideNotes}
                transitions={slideTransitions}
                onExit={() => setLivePresentation(null)}
                presentationId={livePresentation.id}
            />
        )
    }

    return (
        <div className="flex flex-col w-full h-full gap-0.5 relative animate-fade-in flex-1 min-h-0">
            {!isReadOnly && (
                <div className="-ml-1.5 flex flex-col pt-0.5">
                    <EditorMenu menus={slideMenus} onAction={(action, label) => {
                        const NATIVE_ACTIONS = [
                            'open', 'new', 'undo', 'redo', 'clear', 'export', 'export_pptx', 'export_pdf',
                            'toggleGrid', 'toggleSnap', 'toggleGuides', 'toggleRuler',
                            'addText', 'addTextbox', 'addShapeRect', 'addShapeRoundedRect', 'addShapeCircle', 'addShapeEllipse',
                            'addShapeTriangle', 'addShapeStar', 'addShapeArrow', 'addShapeBubble',
                            'addShapeLine', 'addLineArrow', 'addLineElbow', 'addLineCurve',
                            'addMagicLayout', 'toggleFormatPainter', 'toggleListen', 'fullScreen',
                            'bringToFront', 'bringForward', 'sendBackward', 'sendToBack',
                            'pageSetup_portrait', 'pageSetup_landscape', 'groupItems', 'ungroupItems',
                            'addSlide', 'duplicateSlide', 'deleteSlide', 'hideSlide', 'skipSlide',
                            'cut', 'copy', 'paste', 'delete', 'selectAll',
                            'textBold', 'textItalic', 'textUnderline', 'textStrikethrough', 'textSuperscript', 'textSubscript',
                            'alignLeft', 'alignCenter', 'alignRight', 'alignJustify',
                            'lineSpacingSingle', 'lineSpacing1_5', 'lineSpacingDouble',
                            'objectAlignLeft', 'objectAlignCenterH', 'objectAlignRight', 'objectAlignTop', 'objectAlignCenterV', 'objectAlignBottom',
                            'distributeH', 'distributeV',
                            'zoom50', 'zoom75', 'zoom100', 'zoom150', 'zoom200', 'zoomFit',
                            'addChipUser', 'addChipDate', 'addChipFile', 'addChipStatus',
                            'addWorkflowSignature', 'addWorkflowEmail', 'addWorkflowMeeting', 'addTableBlock'
                        ];

                        if (!NATIVE_ACTIONS.includes(action)) {
                            setActiveModal({ id: action, label });
                            return;
                        }

                        const canvas = fabricCanvasRef.current;
                        const active = canvas?.getActiveObject();

                        // File actions
                        if (action === 'open') toast.info("Rendez-vous sur l'accueil Drive pour ouvrir une présentation.");
                        if (action === 'new') window.open('/slides', '_blank');

                        // Edit actions
                        if (action === 'undo') undo();
                        if (action === 'redo') redo();
                        if (action === 'clear') clearSlide();
                        if (action === 'cut') {
                            if (active && canvas) {
                                active.clone().then((cloned: FabricObjectWithId) => {
                                    clipboardRef.current = cloned;
                                    canvas.remove(active);
                                    const activeWithId = active as FabricObjectWithId;
                                    if (activeWithId.id) removeObject(activeWithId.id);
                                    canvas.requestRenderAll();
                                });
                                toast.success('Élément coupé');
                            }
                        }
                        if (action === 'copy') {
                            if (active) {
                                active.clone().then((cloned: FabricObjectWithId) => {
                                    clipboardRef.current = cloned;
                                });
                                toast.success('Élément copié');
                            }
                        }
                        if (action === 'paste') {
                            if (clipboardRef.current && canvas) {
                                clipboardRef.current.clone().then((clonedObj: FabricObjectWithId) => {
                                    canvas.discardActiveObject();
                                    clonedObj.set({ left: (clonedObj.left || 0) + 20, top: (clonedObj.top || 0) + 20, evented: true });
                                    clonedObj.id = Math.random().toString(36).substr(2, 9);
                                    canvas.add(clonedObj);
                                    canvas.setActiveObject(clonedObj);
                                    canvas.requestRenderAll();
                                    if (clonedObj.id) updateObject(clonedObj.id, clonedObj.toObject());
                                });
                                toast.success('Élément collé');
                            }
                        }
                        if (action === 'delete') {
                            if (active && canvas) {
                                canvas.remove(active);
                                const activeWithId = active as FabricObjectWithId;
                                if (activeWithId.id) removeObject(activeWithId.id);
                                canvas.requestRenderAll();
                                toast.success('Élément supprimé');
                            }
                        }
                        if (action === 'selectAll') {
                            if (canvas) {
                                canvas.discardActiveObject();
                                const objs = canvas.getObjects();
                                if (objs.length > 0) {
                                    import("fabric").then((fabricModule) => {
                                        const sel = new fabricModule.ActiveSelection(objs, { canvas });
                                        canvas.setActiveObject(sel);
                                        canvas.requestRenderAll();
                                    });
                                }
                            }
                        }

                        // Export actions
                        if (action === 'export') exportToPNG();
                        if (action === 'export_pptx') exportToPPTX();
                        if (action === 'export_pdf') {
                            toast.info('Export PDF en cours de préparation...');
                            // PDF export uses canvas data URL
                            if (canvas) {
                                const dataURL = canvas.toDataURL({ format: 'png', multiplier: 2 });
                                const link = document.createElement('a');
                                link.download = `Slide-Export-${new Date().toISOString().slice(0, 10)}.pdf`;
                                // For proper PDF, we'd use jsPDF, but for now export as PNG with PDF extension notice
                                toast.info('Export PDF: Utilisez l\'impression du navigateur (Ctrl+P) pour créer un PDF de haute qualité.');
                            }
                        }

                        // View actions
                        if (action === 'toggleGrid') { setShowGrid(!showGrid); toast.success(showGrid ? 'Grille masquée' : 'Grille affichée'); }
                        if (action === 'toggleSnap') { setSnapToGrid(!snapToGrid); toast.success(snapToGrid ? 'Alignement désactivé' : 'Alignement activé'); }
                        if (action === 'toggleGuides') toast.info('Guides: Fonctionnalité bientôt disponible');
                        if (action === 'toggleRuler') toast.info('Règle: Fonctionnalité bientôt disponible');
                        if (action === 'zoom50') toast.success('Zoom à 50%');
                        if (action === 'zoom75') toast.success('Zoom à 75%');
                        if (action === 'zoom100') toast.success('Zoom à 100%');
                        if (action === 'zoom150') toast.success('Zoom à 150%');
                        if (action === 'zoom200') toast.success('Zoom à 200%');
                        if (action === 'zoomFit') toast.success('Zoom ajusté à la fenêtre');
                        if (action === 'fullScreen') {
                            if (!document.fullscreenElement) {
                                document.documentElement.requestFullscreen().catch(() => toast.error("Le plein écran est bloqué."));
                            } else {
                                document.exitFullscreen();
                            }
                        }

                        // Insert shapes
                        if (action === 'addText') addText();
                        if (action === 'addTextbox') addText('Zone de texte', { width: 300 });
                        if (action === 'addShapeRect') addShape('rect');
                        if (action === 'addShapeRoundedRect') {
                            import("fabric").then((fabricModule) => {
                                if (canvas) {
                                    const shape = new fabricModule.Rect({ left: 200, top: 200, width: 100, height: 100, fill: '#818cf8', rx: 16, ry: 16 });
                                    (shape as FabricObjectWithId).id = Math.random().toString(36).substr(2, 9);
                                    canvas.add(shape);
                                    canvas.setActiveObject(shape);
                                }
                            });
                        }
                        if (action === 'addShapeCircle') addShape('circle');
                        if (action === 'addShapeEllipse') {
                            import("fabric").then((fabricModule) => {
                                if (canvas) {
                                    const shape = new fabricModule.Ellipse({ left: 200, top: 200, rx: 60, ry: 40, fill: '#818cf8' });
                                    (shape as FabricObjectWithId).id = Math.random().toString(36).substr(2, 9);
                                    canvas.add(shape);
                                    canvas.setActiveObject(shape);
                                }
                            });
                        }
                        if (action === 'addShapeTriangle') addShape('triangle');
                        if (action === 'addShapeStar') {
                            import("fabric").then((fabricModule) => {
                                if (canvas) {
                                    // Create a star using polygon
                                    const points = [];
                                    const numPoints = 5;
                                    const outerRadius = 50;
                                    const innerRadius = 25;
                                    for (let i = 0; i < numPoints * 2; i++) {
                                        const radius = i % 2 === 0 ? outerRadius : innerRadius;
                                        const angle = (i * Math.PI) / numPoints - Math.PI / 2;
                                        points.push({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
                                    }
                                    const shape = new fabricModule.Polygon(points, { left: 200, top: 200, fill: '#f59e0b' });
                                    (shape as FabricObjectWithId).id = Math.random().toString(36).substr(2, 9);
                                    canvas.add(shape);
                                    canvas.setActiveObject(shape);
                                }
                            });
                        }
                        if (action === 'addShapeArrow') {
                            import("fabric").then((fabricModule) => {
                                if (canvas) {
                                    const points = [{ x: 0, y: 20 }, { x: 60, y: 20 }, { x: 60, y: 0 }, { x: 100, y: 30 }, { x: 60, y: 60 }, { x: 60, y: 40 }, { x: 0, y: 40 }];
                                    const shape = new fabricModule.Polygon(points, { left: 200, top: 200, fill: '#10b981' });
                                    (shape as FabricObjectWithId).id = Math.random().toString(36).substr(2, 9);
                                    canvas.add(shape);
                                    canvas.setActiveObject(shape);
                                }
                            });
                        }
                        if (action === 'addShapeBubble') {
                            import("fabric").then((fabricModule) => {
                                if (canvas) {
                                    // Simple speech bubble simulation
                                    const rect = new fabricModule.Rect({ left: 200, top: 200, width: 150, height: 80, fill: '#e2e8f0', rx: 12, ry: 12 });
                                    (rect as FabricObjectWithId).id = Math.random().toString(36).substr(2, 9);
                                    canvas.add(rect);
                                    canvas.setActiveObject(rect);
                                }
                            });
                        }
                        if (action === 'addShapeLine') addShape('line');
                        if (action === 'addLineArrow') {
                            import("fabric").then((fabricModule) => {
                                if (canvas) {
                                    const line = new fabricModule.Line([50, 50, 200, 50], { left: 200, top: 200, stroke: '#818cf8', strokeWidth: 3 });
                                    (line as FabricObjectWithId).id = Math.random().toString(36).substr(2, 9);
                                    canvas.add(line);
                                    canvas.setActiveObject(line);
                                    toast.info('Ligne avec flèche: ajoutez une forme triangulaire à l\'extrémité');
                                }
                            });
                        }
                        if (action === 'addLineElbow') toast.info('Connecteur coudé: bientôt disponible');
                        if (action === 'addLineCurve') toast.info('Connecteur courbe: bientôt disponible');
                        if (action === 'addMagicLayout') addMagicLayout();

                        // Smart Chips
                        if (action === 'addChipUser') addSmartChip('user', 'Utilisateur');
                        if (action === 'addChipDate') addSmartChip('date', new Date().toLocaleDateString('fr-FR'));
                        if (action === 'addChipFile') addSmartChip('file', 'Document.pdf');
                        if (action === 'addChipStatus') addSmartChip('status', 'En cours', '#10b981');

                        // Workflow blocks
                        if (action === 'addWorkflowSignature') addWorkflow('signature');
                        if (action === 'addWorkflowEmail') addWorkflow('email');
                        if (action === 'addWorkflowMeeting') addWorkflow('meeting');
                        if (action === 'addTableBlock') addTable(3, 3);

                        // Slide actions
                        if (action === 'addSlide') {
                            // This requires access to slideState from parent - dispatch event
                            window.dispatchEvent(new CustomEvent('slides:addSlide'));
                            toast.success('Nouvelle diapositive ajoutée');
                        }
                        if (action === 'duplicateSlide') {
                            window.dispatchEvent(new CustomEvent('slides:duplicateSlide'));
                            toast.success('Diapositive dupliquée');
                        }
                        if (action === 'deleteSlide') {
                            window.dispatchEvent(new CustomEvent('slides:deleteSlide'));
                            toast.success('Diapositive supprimée');
                        }
                        if (action === 'hideSlide') toast.info('Masquer la diapositive: bientôt disponible');
                        if (action === 'skipSlide') toast.info('Sauter la diapositive: bientôt disponible');

                        // Text formatting (for selected text objects)
                        if (action === 'textBold') {
                            if (active && (active.type === 'i-text' || active.type === 'textbox')) {
                                const textObj = active as FabricObjectWithId;
                                textObj.set('fontWeight', textObj.fontWeight === 'bold' ? 'normal' : 'bold');
                                canvas?.requestRenderAll();
                                if (textObj.id) updateObject(textObj.id, active.toObject());
                            }
                        }
                        if (action === 'textItalic') {
                            if (active && (active.type === 'i-text' || active.type === 'textbox')) {
                                const textObj = active as FabricObjectWithId;
                                textObj.set('fontStyle', textObj.fontStyle === 'italic' ? 'normal' : 'italic');
                                canvas?.requestRenderAll();
                                if (textObj.id) updateObject(textObj.id, active.toObject());
                            }
                        }
                        if (action === 'textUnderline') {
                            if (active && (active.type === 'i-text' || active.type === 'textbox')) {
                                const textObj = active as FabricObjectWithId;
                                textObj.set('underline', !textObj.underline);
                                canvas?.requestRenderAll();
                                if (textObj.id) updateObject(textObj.id, active.toObject());
                            }
                        }
                        if (action === 'textStrikethrough') {
                            if (active && (active.type === 'i-text' || active.type === 'textbox')) {
                                const textObj = active as FabricObjectWithId;
                                textObj.set('linethrough', !textObj.linethrough);
                                canvas?.requestRenderAll();
                                if (textObj.id) updateObject(textObj.id, active.toObject());
                            }
                        }
                        if (action === 'textSuperscript') toast.info('Exposant: sélectionnez le texte dans la zone de texte');
                        if (action === 'textSubscript') toast.info('Indice: sélectionnez le texte dans la zone de texte');

                        // Alignment
                        if (action === 'alignLeft') {
                            if (active && (active.type === 'i-text' || active.type === 'textbox')) {
                                const textObj = active as FabricObjectWithId;
                                textObj.set('textAlign', 'left');
                                canvas?.requestRenderAll();
                                if (textObj.id) updateObject(textObj.id, active.toObject());
                            }
                        }
                        if (action === 'alignCenter') {
                            if (active && (active.type === 'i-text' || active.type === 'textbox')) {
                                const textObj = active as FabricObjectWithId;
                                textObj.set('textAlign', 'center');
                                canvas?.requestRenderAll();
                                if (textObj.id) updateObject(textObj.id, active.toObject());
                            }
                        }
                        if (action === 'alignRight') {
                            if (active && (active.type === 'i-text' || active.type === 'textbox')) {
                                const textObj = active as FabricObjectWithId;
                                textObj.set('textAlign', 'right');
                                canvas?.requestRenderAll();
                                if (textObj.id) updateObject(textObj.id, active.toObject());
                            }
                        }
                        if (action === 'alignJustify') {
                            if (active && (active.type === 'i-text' || active.type === 'textbox')) {
                                const textObj = active as FabricObjectWithId;
                                textObj.set('textAlign', 'justify');
                                canvas?.requestRenderAll();
                                if (textObj.id) updateObject(textObj.id, active.toObject());
                            }
                        }

                        // Line spacing
                        if (action === 'lineSpacingSingle') {
                            if (active && (active.type === 'i-text' || active.type === 'textbox')) {
                                const textObj = active as FabricObjectWithId;
                                textObj.set('lineHeight', 1);
                                canvas?.requestRenderAll();
                                if (textObj.id) updateObject(textObj.id, active.toObject());
                            }
                        }
                        if (action === 'lineSpacing1_5') {
                            if (active && (active.type === 'i-text' || active.type === 'textbox')) {
                                const textObj = active as FabricObjectWithId;
                                textObj.set('lineHeight', 1.5);
                                canvas?.requestRenderAll();
                                if (textObj.id) updateObject(textObj.id, active.toObject());
                            }
                        }
                        if (action === 'lineSpacingDouble') {
                            if (active && (active.type === 'i-text' || active.type === 'textbox')) {
                                const textObj = active as FabricObjectWithId;
                                textObj.set('lineHeight', 2);
                                canvas?.requestRenderAll();
                                if (textObj.id) updateObject(textObj.id, active.toObject());
                            }
                        }

                        // Object alignment
                        if (action === 'objectAlignLeft' && active && canvas) {
                            const activeWithId = active as FabricObjectWithId;
                            active.set('left', 0);
                            canvas.requestRenderAll();
                            if (activeWithId.id) updateObject(activeWithId.id, active.toObject());
                        }
                        if (action === 'objectAlignCenterH' && active && canvas) {
                            const activeWithId = active as FabricObjectWithId;
                            active.set('left', (canvas.width! / 2) - ((active.width! * (active.scaleX || 1)) / 2));
                            canvas.requestRenderAll();
                            if (activeWithId.id) updateObject(activeWithId.id, active.toObject());
                        }
                        if (action === 'objectAlignRight' && active && canvas) {
                            const activeWithId = active as FabricObjectWithId;
                            active.set('left', canvas.width! - (active.width! * (active.scaleX || 1)));
                            canvas.requestRenderAll();
                            if (activeWithId.id) updateObject(activeWithId.id, active.toObject());
                        }
                        if (action === 'objectAlignTop' && active && canvas) {
                            const activeWithId = active as FabricObjectWithId;
                            active.set('top', 0);
                            canvas.requestRenderAll();
                            if (activeWithId.id) updateObject(activeWithId.id, active.toObject());
                        }
                        if (action === 'objectAlignCenterV' && active && canvas) {
                            const activeWithId = active as FabricObjectWithId;
                            active.set('top', (canvas.height! / 2) - ((active.height! * (active.scaleY || 1)) / 2));
                            canvas.requestRenderAll();
                            if (activeWithId.id) updateObject(activeWithId.id, active.toObject());
                        }
                        if (action === 'objectAlignBottom' && active && canvas) {
                            const activeWithId = active as FabricObjectWithId;
                            active.set('top', canvas.height! - (active.height! * (active.scaleY || 1)));
                            canvas.requestRenderAll();
                            if (activeWithId.id) updateObject(activeWithId.id, active.toObject());
                        }
                        if (action === 'distributeH') toast.info('Distribution horizontale: sélectionnez plusieurs objets');
                        if (action === 'distributeV') toast.info('Distribution verticale: sélectionnez plusieurs objets');

                        // Arrange
                        if (action === 'bringToFront') {
                            if (active && canvas) {
                                type ObjWithZ = FabricObjectWithId & { zIndex?: number };
                                const activeWithId = active as ObjWithZ;
                                const maxZ = Math.max(0, ...canvas.getObjects().map((o) => (o as ObjWithZ).zIndex || 0));
                                activeWithId.zIndex = maxZ + 1;
                                canvas.bringObjectToFront(active);
                                isUpdatingRef.current = true;
                                if (activeWithId.id) updateObject(activeWithId.id, active.toObject(['id', 'zIndex']));
                                isUpdatingRef.current = false;
                                canvas.requestRenderAll();
                            }
                        }
                        if (action === 'bringForward') {
                            if (active && canvas) {
                                const activeWithId = active as FabricObjectWithId;
                                canvas.bringObjectForward(active);
                                canvas.requestRenderAll();
                                if (activeWithId.id) updateObject(activeWithId.id, active.toObject(['id', 'zIndex']));
                            }
                        }
                        if (action === 'sendBackward') {
                            if (active && canvas) {
                                const activeWithId = active as FabricObjectWithId;
                                canvas.sendObjectBackwards(active);
                                canvas.requestRenderAll();
                                if (activeWithId.id) updateObject(activeWithId.id, active.toObject(['id', 'zIndex']));
                            }
                        }
                        if (action === 'sendToBack') {
                            if (active && canvas) {
                                type ObjWithZ = FabricObjectWithId & { zIndex?: number };
                                const activeWithId = active as ObjWithZ;
                                const minZ = Math.min(0, ...canvas.getObjects().map((o) => (o as ObjWithZ).zIndex || 0));
                                activeWithId.zIndex = minZ - 1;
                                canvas.sendObjectToBack(active);
                                isUpdatingRef.current = true;
                                if (activeWithId.id) updateObject(activeWithId.id, active.toObject(['id', 'zIndex']));
                                isUpdatingRef.current = false;
                                canvas.requestRenderAll();
                            }
                        }

                        // Group/Ungroup
                        if (action === 'groupItems') {
                            if (!canvas) return;
                            if (active && active.type === 'activeSelection') {
                                isUpdatingRef.current = true;
                                const activeWithId = active as FabricObjectWithId;
                                const groupItems = activeWithId.getObjects ? activeWithId.getObjects() : [];
                                const groupId = Math.random().toString(36).substr(2, 9);
                                // toGroup is available on ActiveSelection in fabric v6
                                const group = (active as FabricObjectWithId & { toGroup?: () => FabricObjectWithId }).toGroup?.();
                                if (group) {
                                    group.id = groupId;
                                    updateObject(group.id!, (group as fabric.Object).toObject(['id', 'zIndex']));
                                }
                                groupItems.forEach((item) => { if (item.id) removeObject(item.id); });
                                isUpdatingRef.current = false;
                                canvas.requestRenderAll();
                            } else {
                                toast.error("Sélectionnez plusieurs éléments avec Shift ou la souris pour les grouper.");
                            }
                        }
                        if (action === 'ungroupItems') {
                            if (!canvas) return;
                            if (active && active.type === 'group') {
                                isUpdatingRef.current = true;
                                const activeWithId = active as FabricObjectWithId;
                                const groupId = activeWithId.id;
                                const items = activeWithId.getObjects ? activeWithId.getObjects() : [];
                                // toActiveSelection is available on Group in fabric v6
                                (active as FabricObjectWithId & { toActiveSelection?: () => void }).toActiveSelection?.();
                                if (groupId) removeObject(groupId);
                                items.forEach((item) => {
                                    if (!item.id) item.id = Math.random().toString(36).substr(2, 9);
                                    updateObject(item.id!, (item as fabric.Object).toObject(['id', 'zIndex']));
                                });
                                isUpdatingRef.current = false;
                                canvas.requestRenderAll();
                            } else {
                                toast.error("Sélectionnez un groupe existant pour le dégrouper.");
                            }
                        }

                        // Page setup
                        if (action === 'pageSetup_portrait') setPageConfig({ ...pageConfig, orientation: 'portrait' });
                        if (action === 'pageSetup_landscape') setPageConfig({ ...pageConfig, orientation: 'landscape' });

                        // Format painter & voice
                        if (action === 'toggleFormatPainter') toggleFormatPainter();
                        if (action === 'toggleListen') toggleListen();
                    }} />
                </div>
            )}

            {!isReadOnly && (
                <SlideToolbar
                    isConnected={isConnected}
                    onAddMagicLayout={addMagicLayout}
                    onAddText={addText}
                    onAddShape={() => addShape('rect')}
                    onExport={exportToPNG}
                    onExportPPTX={exportToPPTX}
                    canUndo={canUndo}
                    canRedo={canRedo}
                    onUndo={undo}
                    onRedo={redo}
                    onClear={clearSlide}
                    isListening={isListening}
                    onToggleListen={toggleListen}
                    isFormatPainting={isFormatPainting}
                    onToggleFormatPainter={toggleFormatPainter}
                    showGrid={showGrid}
                    snapToGrid={snapToGrid}
                    onToggleGrid={() => setShowGrid(s => !s)}
                    onToggleSnap={() => setSnapToGrid(s => !s)}
                    pageConfig={pageConfig}
                    onPageConfigChange={setPageConfig}
                    currentLayout={activeSlideId && getSlideLayout ? getSlideLayout(activeSlideId) : undefined}
                    onLayoutChange={activeSlideId && updateSlideLayout
                        ? (layout) => updateSlideLayout(activeSlideId, layout)
                        : undefined}
                    currentThemeId={presentationTheme?.id}
                    onThemeChange={updatePresentationTheme
                        ? (theme: SlideTheme) => {
                            updatePresentationTheme({
                                id: theme.id,
                                backgroundColor: theme.colors.background,
                                primaryColor: theme.colors.primary,
                                secondaryColor: theme.colors.secondary,
                                accentColor: theme.colors.accent,
                                textColor: theme.colors.text,
                                headingFont: theme.fonts.heading,
                                bodyFont: theme.fonts.body
                            })
                            // Also update canvas background color via page config
                            setPageConfig(prev => ({ ...prev, backgroundColor: theme.colors.background }))
                        }
                        : undefined}
                    onAddSlide={addSlide}
                    currentTransition={activeSlideId && getSlideTransition
                        ? getSlideTransition(activeSlideId)
                        : undefined}
                    onTransitionChange={activeSlideId && updateSlideTransition
                        ? (transition) => updateSlideTransition(activeSlideId, transition)
                        : undefined}
                    onToggleAnimations={() => { setShowAnimationPanel(a => !a); setShowMasterEditor(false) }}
                    showAnimations={showAnimationPanel}
                    onToggleMasterEditor={() => { setShowMasterEditor(m => !m); setShowAnimationPanel(false) }}
                    showMasterEditor={showMasterEditor}
                    onStartLivePresentation={handleStartLivePresentation}
                    onAutoLayout={handleAutoLayout}
                />
            )}

            {!isReadOnly && (
                <OmniboxMenu
                    isOpen={omniboxMenu.isOpen}
                    x={omniboxMenu.x}
                    y={omniboxMenu.y}
                    onClose={() => setOmniboxMenu({ ...omniboxMenu, isOpen: false })}
                    onInsertText={addText}
                    onInsertShape={addShape}
                    onInsertImage={addImage}
                    onInsertMagicLayout={addMagicLayout}
                    onInsertSmartChip={addSmartChip}
                    onInsertWorkflow={addWorkflow}
                    onInsertTable={addTable}
                />
            )}

            {/* Main Editor Area */}
            <div className="flex flex-col w-full h-full relative animate-fade-in flex-1 min-h-0">


                <div className="flex-1 w-full flex items-stretch min-h-0 relative">
                    {/* Outline Sidebar (Left) */}
                    <div className="w-64 border-r border-gray-200 dark:border-gray-800 bg-background dark:bg-[#1a1a1a] hidden md:block z-10">
                        <DocumentOutline canvasRef={fabricCanvasRef} />
                    </div>

                    <div className="flex-1 flex flex-col items-center justify-start min-h-0 overflow-hidden relative">
                        <Ruler width={816} />
                        <div className="relative flex-1 w-full overflow-hidden">
                            <SlideCanvas
                                objects={objects}
                                updateObject={updateObject}
                                fabricCanvasRef={fabricCanvasRef}
                                isUpdatingRef={isUpdatingRef}
                                onSelectionChange={setActiveObject}
                                onCursorMove={updateCursor}
                                showGrid={showGrid}
                                snapToGrid={snapToGrid}
                                pageConfig={pageConfig}
                            />
                            <CursorOverlay
                                collaborators={mergedCollaborators}
                                activeSlideId={activeSlideId || "doc"}
                            />
                        </div>
                    </div>

                    {/* Animation Panel (Right sidebar) */}
                    {showAnimationPanel && !isReadOnly && (
                        <AnimationPanel
                            selectedObjectId={activeObject ? (activeObject as FabricObjectWithId).id || null : null}
                            animationConfig={animationConfig}
                            onAnimationChange={handleAnimationChange}
                            onPreview={handleAnimationPreview}
                            onClose={() => setShowAnimationPanel(false)}
                        />
                    )}

                    {/* Master Slide Editor (Right sidebar) */}
                    {showMasterEditor && !isReadOnly && (
                        <MasterSlideEditor
                            masters={masterSlides}
                            activeMasterId={activeSlideId && getSlideMaster ? getSlideMaster(activeSlideId) || null : null}
                            onSelectMaster={handleMasterSelect}
                            onUpdateMaster={handleMasterUpdate}
                            onAddMaster={handleMasterAdd}
                            onDeleteMaster={handleMasterDelete}
                            onClose={() => setShowMasterEditor(false)}
                        />
                    )}
                </div>
            </div>

            {/* Contextual Properties Panel (Right)
                Only show when an object is selected
            */}
            {!isReadOnly && (
                <SlidePropertyPanel
                    activeObject={activeObject}
                    updateObjectRemotely={handleUpdateActiveObject}
                    canvasRef={fabricCanvasRef}
                />
            )}

            {/* Speaker Notes Panel (Bottom) */}
            {updateSlideNotes && getSlideNotes && (
                <SpeakerNotesPanel
                    slideId={activeSlideId}
                    notes={activeSlideId ? getSlideNotes(activeSlideId) : ''}
                    onNotesChange={(notes) => {
                        if (activeSlideId) {
                            updateSlideNotes(activeSlideId, notes)
                        }
                    }}
                    isReadOnly={isReadOnly}
                />
            )}

            {/* Floating AI Bottom Pill */}
            {!isReadOnly && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 shadow-lg rounded-full animate-fade-in-up">
                    <button
                    onClick={addMagicLayout}
                    className="flex items-center gap-2 group px-6 py-2.5 bg-[#c2e7ff] hover:bg-[#a8d3f1] text-[#001d35] rounded-full text-[14px] font-medium transition-all shadow-md dark:bg-[#004a77] dark:hover:bg-[#005a92] dark:text-[#c2e7ff]"
                >
                    <Wand2 className="w-4 h-4 text-[#0b57d0] dark:text-[#a8c7fa] group-hover:scale-110 transition-transform" />
                    Améliorer cette diapositive
                </button>
            </div>
            )}

            <GenericFeatureModal 
                isOpen={!!activeModal} 
                actionId={activeModal?.id || null} 
                actionLabel={activeModal?.label}
                onClose={() => setActiveModal(null)} 
            />
        </div>
    )
}
