import { Header, ParameterEditor, Preview } from './components';
import { cx } from './utils';

export const App = () => {
  return (
    <div className={cx('App', 'flex flex-col w-full h-full bg-gray-100')}>
      <div>
        <Header />
      </div>
      <div className="flex min-h-0 flex-1 flex-col-reverse md:flex-row">
        <div className="min-h-0 flex-1 overflow-auto md:w-80 md:flex-initial">
          <ParameterEditor />
        </div>
        <div className="h-1/2 min-h-0 md:h-full md:flex-1">
          <Preview />
        </div>
      </div>
    </div>
  );
};
