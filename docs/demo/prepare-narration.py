import json,subprocess,re,sys
from pathlib import Path
import imageio_ffmpeg
root=Path(__file__).resolve().parents[2];out=root/'outputs/demos';assets=out/'assets';assets.mkdir(parents=True,exist_ok=True)
ffmpeg=imageio_ffmpeg.get_ffmpeg_exe();chapters=json.loads((root/'docs/demo/chapters.json').read_text())
for chapter in chapters:
 name=chapter['id'];(assets/(name+'.txt')).write_text(chapter['narration']);audio=assets/(name+'.aiff')
 subprocess.run(['say','-v','Samantha','-r','170','-f',str(assets/(name+'.txt')),'-o',str(audio)],check=True)
 check=subprocess.run([ffmpeg,'-hide_banner','-i',str(audio)],capture_output=True,text=True).stderr
 match=re.search(r'Duration: (\d+):(\d+):(\d+\.\d+)',check)
 chapter['audio_duration']=int(match[1])*3600+int(match[2])*60+float(match[3]);chapter['audio']=str(audio)
 (assets/(name+'-title.txt')).write_text(chapter['title']);(assets/(name+'-caption.txt')).write_text(chapter['caption'])
 print(name,chapter['audio_duration'],flush=True)
(out/'chapters.json').write_text(json.dumps(chapters,indent=2));(assets/'provenance.txt').write_text('DEVELOPMENT PREVIEW  |  LIVE SUPABASE + POSTHOG CONNECTIONS  |  FICTIONAL SHOPPERS + SIMULATED PAYMENTS')
print('NARRATION_READY',flush=True)
