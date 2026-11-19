// The real terrain generator's island for one seed, drawn with the look
// fixtures (scenarios/look/fixtures/generated.ts). Seeds 2 to 4 are beside it.
//
//   npm run shots -- 'look-generated*'
import { generatedScenario } from './fixtures/generated';

export default generatedScenario(1);
