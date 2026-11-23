import {Fragment} from 'react';
// Render the analyst's limited Markdown as React text nodes, never raw HTML.
function inline(text:string){return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part,i)=>part.startsWith('**')?<strong key={i}>{part.slice(2,-2)}</strong>:part.startsWith('`')?<code key={i}>{part.slice(1,-1)}</code>:<Fragment key={i}>{part}</Fragment>);}
const cells=(line:string)=>line.trim().replace(/^\|/,'').replace(/\|$/,'').split('|').map(v=>v.trim());
export default function AnswerText({text}:{text:string}){
 const lines=String(text||'').split('\n'),blocks=[];let i=0;
 while(i<lines.length){
  if(!lines[i].trim()){i++;continue;}
  const key=i;
  if(i+1<lines.length&&lines[i].includes('|')&&/^\s*\|?\s*:?-{3,}/.test(lines[i+1])&&cells(lines[i+1]).every(v=>/^:?-{3,}:?$/.test(v))){
   const header=cells(lines[i]);i+=2;const rows=[];while(i<lines.length&&lines[i].includes('|')&&lines[i].trim())rows.push(cells(lines[i++]));
   blocks.push(<div className="answer-table" key={key}><table><thead><tr>{header.map((v,j)=><th key={j}>{inline(v)}</th>)}</tr></thead><tbody>{rows.map((row,j)=><tr key={j}>{row.map((v,k)=><td key={k}>{inline(v)}</td>)}</tr>)}</tbody></table></div>);continue;
  }
  if(/^#{1,6}\s/.test(lines[i])){blocks.push(<h3 key={key}>{inline(lines[i++].replace(/^#{1,6}\s+/,''))}</h3>);continue;}
  if(/^\s*[-*]\s+/.test(lines[i])){const items=[];while(i<lines.length&&/^\s*[-*]\s+/.test(lines[i]))items.push(lines[i++].replace(/^\s*[-*]\s+/,''));blocks.push(<ul key={key}>{items.map((v,j)=><li key={j}>{inline(v)}</li>)}</ul>);continue;}
  const paragraph=[lines[i++]];while(i<lines.length&&lines[i].trim()&&!/^#{1,6}\s|^\s*[-*]\s+/.test(lines[i])&&!(i+1<lines.length&&lines[i].includes('|')&&/^\s*\|?\s*:?-{3,}/.test(lines[i+1])))paragraph.push(lines[i++]);
  blocks.push(<p key={key}>{inline(paragraph.join('\n'))}</p>);
 }
 return <div className="answer-text answer-rich">{blocks}</div>;
}
