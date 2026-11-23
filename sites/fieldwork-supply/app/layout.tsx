import type {Metadata} from "next";
export const metadata:Metadata={title:"Fieldwork Supply",description:"A working demo shop with persistent carts and orders."};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body style={{margin:0}}>{children}</body></html>}
