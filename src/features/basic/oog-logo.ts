import $style from './oog-logo.module.css';

function init() {
  applyCssRule(`.${C.Frame.logo}`, $style.logo);
  applyCssRule(`.${C.Frame.logoLoading}`, $style.logoLoading);
}

features.add(
  import.meta.url,
  init,
  'Replaces the APEX logo, including the loading animation, with the OOG logo.',
);
