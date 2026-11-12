const paths:Record<string,string>={
  'message-circle':'M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9H13a8.5 8.5 0 0 1 8 8v.5',
  food:'M4 3v6a2 2 0 0 0 4 0V3 M6 3v18 M20 21V3c-4 2-5 7-4 10h4',
  shirt:'m8 3-6 4 3 5 3-2v11h8V10l3 2 3-5-6-4c0 4-8 4-8 0',
  phone:'M7 2h10v20H7V2 M10 18h4',
  sparkles:'m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3',
  tool:'M14 6a5 5 0 0 0-6 6L2 18l4 4 6-6a5 5 0 0 0 6-6l-3 3-4-4 3-3',
  search:'m21 21-4.5-4.5 M19 10.5a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0',
  plus:'M12 5v14 M5 12h14',
  arrow:'M5 12h14 m-6-6 6 6-6 6',
  pin:'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0 M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  bag:'M5 7h14l2 14H3L5 7 M8 8V6a4 4 0 0 1 8 0v2',
  user:'M20 21v-2a7 7 0 0 0-14 0v2 M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  shield:'m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6l9-4 m-4 10 3 3 5-6',
  close:'m6 6 12 12 M18 6 6 18',
  moon:'M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13',
  sun:'M12 2v2 M12 20v2 M2 12h2 M20 12h2 m-5.7-7.7 1.4 1.4 M4.3 19.7l1.4-1.4 M4.3 4.3l1.4 1.4 m12.6 12.6 1.4 1.4 M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  edit:'m16 3 5 5-12 12-6 1 1-6L16 3 M14 5l5 5',
  trash:'M3 6h18 M9 6V3h6v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7',
  check:'m5 12 4 4L19 6',
  home:'m3 10 9-8 9 8 M5 9v13h14V9 M9 22v-9h6v9'
};
export function Icon({name,className=''}:{name:string;className?:string}){
  return <svg className={`icon ${className}`} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]||paths.bag}/></svg>;
}
