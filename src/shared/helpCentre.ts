export type HelpArticleContent={title:string;category:string;summary:string;body:string;kind:'guide'|'faq'};
export type PublishedHelpArticle=HelpArticleContent & {id:string;published_at?:string};
export type HelpArticleDraft=HelpArticleContent & {id:string;revision:number;publication:HelpArticleContent|null;archived:boolean};
