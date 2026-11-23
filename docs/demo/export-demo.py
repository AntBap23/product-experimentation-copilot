"""Export a captioned, silent 1080p walkthrough from actual browser footage."""
import json,subprocess,re,math,concurrent.futures
from pathlib import Path
import imageio_ffmpeg
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'outputs/walkthrough';ASSETS=OUT/'captions';CLIPS=OUT/'clips'
ASSETS.mkdir(exist_ok=True);CLIPS.mkdir(exist_ok=True)
FFMPEG=imageio_ffmpeg.get_ffmpeg_exe();manifest=json.loads((OUT/'timeline.json').read_text());scenes=manifest['timeline'];raw=manifest['raw_video']
probe=subprocess.run([FFMPEG,'-hide_banner','-i',raw],capture_output=True,text=True).stderr
m=re.search(r'Duration: (\d+):(\d+):(\d+\.\d+)',probe);duration=int(m[1])*3600+int(m[2])*60+float(m[3]);offset=duration-scenes[-1]['end'];offset=offset if abs(offset)<2 else 0
print(json.dumps({'raw_seconds':duration,'timeline_seconds':scenes[-1]['end'],'clock_offset':offset}),flush=True)
font='/System/Library/Fonts/Supplemental/Arial.ttf';bold='/System/Library/Fonts/Supplemental/Arial Bold.ttf'
(ASSETS/'provenance.txt').write_text('Actual local preview · live source connections · fictional shoppers and payments · AI waits shortened · no voiceover')
def encode(scene):
 name=scene['id'];length=math.floor((scene['end']-scene['start'])*25)/25;scene['export_duration']=length
 for key in ['title','caption']:(ASSETS/(name+'-'+key+'.txt')).write_text(scene[key])
 filters=['fps=25','scale=1920:940','pad=1920:1080:0:0:color=0x121b2c',f"drawtext=fontfile='{bold}':textfile='{ASSETS/(name+'-title.txt')}':expansion=none:fontcolor=white:fontsize=28:x=54:y=960",f"drawtext=fontfile='{font}':textfile='{ASSETS/(name+'-caption.txt')}':expansion=none:fontcolor=0xc1cce0:fontsize=23:x=54:y=1004",f"drawtext=fontfile='{font}':textfile='{ASSETS/'provenance.txt'}':expansion=none:fontcolor=0x8294b6:fontsize=14:x=54:y=1052",'fade=t=in:st=0:d=0.16',f'fade=t=out:st={max(0,length-.2)}:d=0.2']
 command=[FFMPEG,'-hide_banner','-loglevel','error','-y','-ss',str(max(0,scene['start']+(0 if scene.get('raw_video') else offset))),'-i',scene.get('raw_video',raw),'-t',str(length),'-vf',','.join(filters),'-an','-c:v','libx264','-preset','fast','-crf','20','-threads','3','-pix_fmt','yuv420p','-video_track_timescale','25000','-movflags','+faststart',str(CLIPS/(name+'.mp4'))]
 subprocess.run(command,check=True);print('ENCODED '+name+' '+str(length),flush=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:list(executor.map(encode,scenes))
name='fieldwork-full-demo';(OUT/(name+'-concat.txt')).write_text(''.join("file '"+str(CLIPS/(s['id']+'.mp4'))+"'\n" for s in scenes))
meta=[';FFMETADATA1','title=Fieldwork — purchase, AI analytics and experiment readout','artist=Fieldwork','comment=Actual local preview using live sources. Captioned with no voiceover. Fictional shoppers and payments. Model waits shortened.'];vtt=['WEBVTT',''];elapsed=0
for s in scenes:
 end=elapsed+s['export_duration'];meta+=['[CHAPTER]','TIMEBASE=1/1000','START='+str(round(elapsed*1000)),'END='+str(round(end*1000)),'title='+s['title']]
 def stamp(t):
  ms=round(t*1000);h,ms=divmod(ms,3600000);m,ms=divmod(ms,60000);sec,ms=divmod(ms,1000);return f'{h:02}:{m:02}:{sec:02}.{ms:03}'
 vtt +=[stamp(elapsed)+' --> '+stamp(end),s['title']+'\n'+s['caption'],''];elapsed=end
(OUT/(name+'.ffmeta')).write_text('\n'.join(meta)+'\n');(OUT/(name+'.vtt')).write_text('\n'.join(vtt))
subprocess.run([FFMPEG,'-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',str(OUT/(name+'-concat.txt')),'-i',str(OUT/(name+'.ffmeta')),'-map','0:v:0','-map_metadata','1','-c','copy','-an','-movflags','+faststart',str(OUT/(name+'.mp4'))],check=True)
(OUT/'exports.json').write_text(json.dumps({'file':name+'.mp4','duration_seconds':elapsed,'chapters':len(scenes),'audio':False,'model_answers':len(manifest['evidence']),'provenance':manifest['provenance']},indent=2))
print('EXPORTED '+str(elapsed)+' seconds',flush=True)
