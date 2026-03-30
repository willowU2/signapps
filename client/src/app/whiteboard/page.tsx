import { Metadata } from 'next';
import WhiteboardClient from './whiteboard-client';

export const metadata: Metadata = {
    title: 'Tableau blanc — SignApps',
    description: 'Tableau blanc collaboratif en temps réel',
};

export default function WhiteboardPage() {
    return <WhiteboardClient />;
}
