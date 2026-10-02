export const SESSION_EXPIRED_EVENT = "idea-bag:session-expired";

export class ApiError extends Error {
	readonly status: number;
	readonly code?: string;

	constructor(status: number, code?: string) {
		super(errorMessage(status, code));
		this.name = "ApiError";
		this.status = status;
		this.code = code;
	}
}

function errorMessage(status: number, code?: string): string {
	if (code === "DUPLICATE_LABEL") return "同じ名前のラベルが既にあります。";
	if (code === "MEMO_ORDER_CONFLICT") return "メモ一覧が変更されました。再読み込みしてから並べ替えてください。";
	if (code === "AUTH_NOT_CONFIGURED") return "ログインの設定が未完了です。管理者にお問い合わせください。";
	switch (status) {
		case 400: return "入力内容を確認して、もう一度お試しください。";
		case 401: return "ログインの有効期限が切れました。再度ログインしてください。";
		case 403: return "この操作は許可されていません。";
		case 404: return "対象のメモまたはラベルが見つかりません。一覧を再読み込みしてください。";
		case 409: return "データが変更されています。再読み込みしてからお試しください。";
		case 502: return "AIの生成に失敗しました。少し待って、もう一度お試しください。";
		case 503: return "現在サービスを利用できません。少し待って再度お試しください。";
		default: return "処理に失敗しました。少し待って、もう一度お試しください。";
	}
}

export function notifyUnauthorized(status: number) {
	if (status === 401 && typeof window !== "undefined") {
		window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
	}
}

export function getErrorMessage(error: unknown): string {
	return error instanceof ApiError ? error.message : "通信に失敗しました。接続を確認して、もう一度お試しください。";
}

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
	const headers = new Headers(init.headers);
	if (init.body !== undefined) headers.set("Content-Type", "application/json");
	const response = await fetch(path, { ...init, headers, credentials: "same-origin" });
	if (!response.ok) {
		const body: unknown = await response.json().catch(() => null);
		let code: string | undefined;
		if (body && typeof body === "object" && "error" in body) {
			const error = body.error;
			if (error && typeof error === "object" && "code" in error && typeof error.code === "string") code = error.code;
		}
		notifyUnauthorized(response.status);
		throw new ApiError(response.status, code);
	}
	if (response.status === 204) return undefined as T;
	return response.json() as Promise<T>;
}
