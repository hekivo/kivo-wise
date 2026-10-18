# File uploads with Livewire 4 under Acorn

Deep reference for `WithFileUploads`, temporary storage and moving files into the WordPress media library. Loaded on demand from SKILL.md.

The upload routes exist as soon as Livewire is installed: `POST /livewire-<hash>/upload-file` and `GET /livewire-<hash>/preview-file/{filename}` (check with `{{runner.acorn}} route:list --path=livewire`). Settle the decisions below with the user before the first upload component.

## Decide first

1. **Temporary disk.** `config/livewire.php` → `temporary_file_upload.disk` defaults to `null`, which means the default filesystem disk. Under Acorn without a project `config/filesystems.php` that is Acorn's default `local` disk under the app's `storage/app`. Check with `{{runner.wp}} eval 'echo config("filesystems.default");'`.
2. **More than one web instance?** The upload request and the save request can land on different instances, so a local temporary file is not safe. Use a shared disk (S3-compatible) for temporary uploads, or keep uploads out of Livewire.
3. **Final destination.** For the media library, sideload into WordPress (below). If an offload plugin is active, attachments go through it; never write into the uploads folder directly.
4. **Edge rules.** Upload endpoints may sit behind a WAF or rate limits. Ask whoever owns them before adding a large or high-volume flow.

## Pattern

```php
namespace App\Livewire;   // your class_namespace

use Livewire\Attributes\Validate;
use Livewire\Component;
use Livewire\WithFileUploads;

class LogoUpload extends Component
{
    use WithFileUploads;

    #[Validate('image|max:2048')]   // kilobytes
    public $logo;

    public ?int $attachmentId = null;

    public function save(): void
    {
        abort_unless(current_user_can('upload_files'), 403);

        $this->validate();

        require_once ABSPATH . 'wp-admin/includes/file.php';
        require_once ABSPATH . 'wp-admin/includes/media.php';
        require_once ABSPATH . 'wp-admin/includes/image.php';

        $id = media_handle_sideload([
            'name' => $this->logo->getClientOriginalName(),
            'tmp_name' => $this->logo->getRealPath(),
        ], 0);

        if (! is_wp_error($id)) {
            $this->attachmentId = $id;
        }

        $this->reset('logo');   // never keep the temporary file in state
    }

    public function render()
    {
        return view('livewire.logo-upload');
    }
}
```

```blade
<div>
  <input type="file" wire:model="logo" accept="image/*">
  @error('logo') <p>{{ $message }}</p> @enderror
  <button type="button" wire:click="save" wire:loading.attr="disabled" wire:target="logo,save">Upload</button>
</div>
```

- `wire:model` on a file input uploads immediately to the temporary endpoint; the other v4 modifier rules do not apply to file inputs.
- `media_handle_sideload()` needs the three `wp-admin/includes` files outside wp-admin. Update requests are front-end requests.
- Check permissions explicitly. Update requests run as the WordPress user from the auth cookie, and anonymous visitors can call any public action.
- Vendor defaults for temporary uploads: rules `required|file|max:12288` (12 MB), middleware `throttle:60,1`, directory `livewire-tmp`, `max_upload_time` 5 minutes, cleanup of files older than 24 hours.

## Verify

A unit test for the save logic with a faked uploaded file through `{{runner.test}}`, then a manual upload with the Network tab open, on every language or site variant the page has.
