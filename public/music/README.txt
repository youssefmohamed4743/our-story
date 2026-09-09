Put ONE audio file in this folder, then point content.js -> music.src at it.

The extension must match what the file REALLY is. iOS Safari derives the
Content-Type from it and refuses to decode a mismatch, so an AAC file named
.mp3 plays fine on desktop and is silent on every iPhone -- and because the
element then fires an error, the mute toggle never appears either.

Check before you rename:  xxd -l 4 yourfile
  ftyp....  -> AAC/MP4  -> name it our-song.m4a
  ID3 / 0xFFFB -> MPEG  -> name it our-song.mp3
