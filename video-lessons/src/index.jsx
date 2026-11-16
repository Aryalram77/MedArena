import { Composition, registerRoot } from 'remotion';
import Lesson from './Lesson.jsx';
import plan from './plan.json';

const FPS = 30;

const totalFrames = () => {
  let frames = 0;
  for (const seg of plan.segments) {
    if (seg.type === 'cover') {
      frames += seg.frames;
    } else if (seg.type === 'question') {
      const f = seg.frames;
      frames += f.intro + f.question + f.options + f.reveal + f.explanation;
    }
  }
  frames += plan.outro_frames;
  return frames;
};

export const LessonComposition = () => {
  return (
    <Composition
      id="Lesson"
      component={Lesson}
      durationInFrames={totalFrames()}
      fps={FPS}
      width={1920}
      height={1080}
      defaultProps={{}}
    />
  );
};

registerRoot(LessonComposition);
