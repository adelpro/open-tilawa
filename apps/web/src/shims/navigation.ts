import { useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom';
export function useRouter() {
  const navigate = useNavigate();
  return {
    push: (url: string) => navigate(url),
    replace: (url: string) => navigate(url, { replace: true }),
    back: () => navigate(-1),
    pathname: useLocation().pathname,
  };
}
export { useParams, useSearchParams };
export function usePathname() {
  return useLocation().pathname;
}
export function notFound() {
  throw new Response('Not Found', { status: 404 });
}
