// L07's 'window-light' actor draws nothing: the panes it lights belong to
// the house's own mesh. This part exists so the actor is not drawn as a
// placeholder marker.

import { definePart } from '@/gen/api';
import { emptyMesh } from '@/gen/mesh';

export default definePart({
  actor: 'window-light',
  build: () => ({ mesh: emptyMesh() }),
});
