export const dynamic="force-dynamic";
export default async function Store({searchParams}:{searchParams:Promise<Record<string,string>>}){const params=new URLSearchParams(await searchParams);return <iframe title="Fieldwork Supply storefront" src={"/store/index.html?"+params} style={{display:"block",width:"100%",height:"100dvh",border:0}}/>}
