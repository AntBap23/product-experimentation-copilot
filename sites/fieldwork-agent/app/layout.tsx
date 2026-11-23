import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'Fieldwork | Analytics workspace',description:'Investigate product behavior with traceable database and event evidence.'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
