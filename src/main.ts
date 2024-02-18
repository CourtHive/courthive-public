import { rootBlock } from './components/framework/rootBlock';
import { setInitialState } from 'src/config/initialState';
import { router } from 'src/router/router';
import { context } from './common/context';

const body = document.body;
body.appendChild(rootBlock());
setInitialState();

context.router = router();
