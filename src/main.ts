import { rootBlock } from './components/framework/rootBlock';
import { setInitialState } from 'src/config/initialState';
import { router } from 'src/router/router';
import { context } from './common/context';

setInitialState();
const body = document.body;
body.appendChild(rootBlock());
context.router = router();
