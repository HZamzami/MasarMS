import { Redirect } from 'expo-router';

export default function Index() {
  // We redirect to the dashboard group by default.
  // The root _layout.tsx will intercept this and send 
  // unauthorized users to /(auth)/welcome automatically.
  return <Redirect href="/(app)/" />;
}
