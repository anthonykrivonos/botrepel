import type { Article } from "../article-types";
import { code, diagram, guideArticle, p, ul } from "../guide-blocks";
import { ASSURANCE_SENTENCE, PRICE_SENTENCE, TOKEN_SENTENCE } from "../guide-facts";

const django = guideArticle("accounts", "bot-protection-django", {
  heading: "Add human verification to a Django form",
  title: "Add human verification to a Django form",
  description: "Add human verification to a Django form and verify the token in the view before you create the user.",
  ogAlt: "A Django template embeds the widget iframe. The view calls siteverify, then creates the user.",
  summary:
    "Keep Django's CSRF check. Embed the BotRepel iframe in the template and copy the token into botrepel-response. In the view, POST the token to /v1/siteverify with the secret, and create the user only when success is true and the action is signup. Read the secret from the environment, not from a setting that you commit.",
  sections: [
    {
      heading: "Leave CSRF on",
      blocks: [
        p(
          "BotRepel does not replace Django's CSRF token. A cross-site post should still fail the CSRF check before you spend a verification. Render {% csrf_token %} in the form, and do not mark the view csrf_exempt. The human token answers a different question: whether this browser completed the check for the signup action.",
        ),
        p(
          "There is no Django package in this repository. Call the HTTP API. The [docs](/docs#verify) show a short Python example with requests. The same body accepts a form encoding or JSON. Set a timeout so a slow call cannot hold a worker. The server SDK uses five seconds. Match that.",
        ),
        diagram(
          "bot-protection-django",
          "The template posts the CSRF token and botrepel-response. The Django view checks CSRF, calls siteverify, and creates the user only after success.",
          "CSRF and siteverify both run on the server. Neither one stands in for the other.",
        ),
      ],
    },
    {
      heading: "Template",
      blocks: [
        p(
          "The iframe URL is the widget page from the [HTML docs](/docs#html). Replace the site key and URL-encode the origin. The script checks the message origin and the source window, then stores the token.",
        ),
        code(
          "signup.html",
          `<form method="post">
  {% csrf_token %}
  <label>Email <input name="email" type="email" autocomplete="email" required></label>
  <iframe id="botrepel" title="Human verification"
    src="https://botrepel.com/w/br_pk_YOUR_SITE_KEY?origin=https%3A%2F%2Fexample.com&action=signup"
    allow="camera; publickey-credentials-get; publickey-credentials-create"
    style="width:300px;height:64px;border:0"></iframe>
  <input type="hidden" name="botrepel-response" value="">
  <button type="submit">Create account</button>
</form>`,
        ),
        p(
          "Load the message listener from a static file. The listener is the same one in the [Express guide](/articles/bot-protection-express): ignore events whose origin is not https://botrepel.com, ignore events whose source is not the iframe, and on botrepel:token write event.data.token into the hidden field. Add the fixed-position class when the message type is botrepel:expand, using the CSS from the docs, so a light check can use the screen.",
        ),
      ],
    },
    {
      heading: "View",
      blocks: [
        code(
          "views.py",
          `import os
import requests
from django.http import HttpResponse
from django.shortcuts import render
from django.views.decorators.http import require_http_methods

def siteverify(token: str, action: str) -> bool:
    secret = os.environ["BOTREPEL_SECRET_KEY"]
    try:
        result = requests.post(
            "https://botrepel.com/v1/siteverify",
            json={"secret": secret, "response": token},
            timeout=5,
        ).json()
    except requests.RequestException:
        return False
    return bool(result.get("success")) and result.get("action") == action and result.get("hostname") == "example.com"

@require_http_methods(["GET", "POST"])
def signup(request):
    if request.method == "POST":
        token = request.POST.get("botrepel-response", "")
        if not siteverify(token, "signup"):
            return HttpResponse("Verification failed", status=403)
        # Create the user from request.POST["email"], then confirm the address.
        return HttpResponse("Account created", status=201)
    return render(request, "signup.html")`,
        ),
        p(
          `Compare action and hostname yourself. The HTTP API does not take expectedAction. The Node helper does that comparison locally after a successful response. ${TOKEN_SENTENCE} A second post of the same token returns timeout-or-duplicate. ${PRICE_SENTENCE}`,
        ),
        p(
          `${ASSURANCE_SENTENCE} If you need a minimum level, read result["assurance"] and accept only the levels you allow. The order, weakest to strongest, is invisible, presence, liveness. A stronger token satisfies a weaker requirement.`,
        ),
        p(
          'Set BOTREPEL_SECRET_KEY in the environment that systemd, the platform, or your process manager passes in. Django will not keep it out of a traceback if you interpolate it into an error string. Log result.get("error-codes") only.',
        ),
      ],
    },
    {
      heading: "Hosts, tests, and the admin",
      blocks: [
        ul([
          "Add example.com and your dev host to the BotRepel site. The origin query on the iframe has to match the page the person is actually on.",
          "Do not set expected hostname from request.get_host(). That value follows the Host header. Pin example.com, or compare against a list you configured.",
          "A test can mock requests.post. Do not point the test at production with a real secret, and do not skip the check when DEBUG is true. A forgotten debug bypass is the usual production hole.",
          "Django admin login is a separate form. Repeat the widget and the verify call there if that login is on the public internet. The signup view does not cover /admin/login/.",
        ]),
        p(
          "Pair the view with the [rate limit](/articles/rate-limit-signup-and-login) pattern that uses Django's cache. A cache outage policy belongs next to the view: fail closed for signup if you would rather stop registration than accept unverified posts.",
        ),
      ],
    },
    {
      heading: "Tests and the hosts you will actually hit",
      blocks: [
        p(
          "ALLOWED_HOSTS is Django's list of Host headers it will serve. BotRepel's expected hostname is the host you configured for the widget. They can both be example.com and still be different checks. A request that passes ALLOWED_HOSTS with a Host of preview.example.com must not be verified as example.com. Pin the string in the view. Add preview.example.com to the BotRepel site only if that preview is yours, and pass that host as the iframe origin on that deployment.",
        ),
        p(
          "A unit test should post the view with the CSRF token and a fake token, with requests.post mocked to return success false, and assert status 403 and that the user was not created. A second test mocks success true and asserts the user exists. Do not skip the branch when DEBUG is true. A settings flag named SKIP_BOTREPEL is how the check disappears in production six months later. If a developer needs a local bypass, make it a separate settings module that cannot be imported when the production env var is set, and cover that with a test that imports the production settings and asserts the view still calls siteverify.",
        ),
        p(
          "The admin login at /admin/login/ does not use the signup view. If the admin is on the public internet, put the iframe on that template too, or restrict the admin by IP at the proxy. A signup check does not slow password guessing on the admin form. Use action login there so a signup token cannot be replayed into the admin. Run the same 403 test against the admin view if you protect it. A green signup test does not execute that template.",
        ),
        p(
          "requests is a dependency you add. Pin it in requirements. A missing timeout is the bug that ties up Gunicorn workers when BotRepel is slow. Five seconds matches the server SDK. If you already have a shared HTTP client, use it, and still set the timeout on this call. Do not follow redirects to a different host with the secret in the body. The URL is https://botrepel.com/v1/siteverify and the method is POST. Log the status code when the JSON cannot be parsed. A proxy that returns an HTML block page will otherwise look like a verification failure with no error-codes, and you will debug the form instead of the egress rule. Open the worker egress to botrepel.com on port 443 before you blame the template. A local run can succeed while the production security group drops the call. Test the production URL with a throwaway account after the security group change. Repeat the test when the worker moves to a new subnet. Write botrepel.com, port 443, and the five-second timeout in the runbook next to the secret name.",
        ),
      ],
    },
  ],
  howTo: {
    name: "Protect a Django signup view",
    steps: [
      {
        name: "Keep the CSRF token",
        text: "Render csrf_token in the form and do not exempt the view.",
      },
      {
        name: "Embed the widget iframe",
        text: "Point it at your site key with the page origin and action signup. Copy the token into botrepel-response.",
      },
      {
        name: "POST to siteverify",
        text: "Send the secret and the token with a five-second timeout. Require success, action signup, and hostname example.com.",
      },
      {
        name: "Create the user after success",
        text: "Insert the account only when the check returns true, then send confirmation.",
      },
    ],
  },
  faqs: [
    {
      question: "Does BotRepel replace Django's CSRF protection?",
      answer: "No. Keep the CSRF token. siteverify checks the human verification token. A posted form needs both.",
    },
    {
      question: "Is there an official Django package in this repo?",
      answer:
        "No. Call https://botrepel.com/v1/siteverify from the view. The request body is the secret and the response token.",
    },
  ],
  related: [
    "/articles/bot-protection-express",
    "/articles/stop-fake-signups",
    "/articles/rate-limit-signup-and-login",
    "/docs",
  ],
  sources: [
    { name: "BotRepel docs", href: "/docs" },
    {
      name: "Django CSRF protection",
      href: "https://docs.djangoproject.com/en/stable/howto/csrf/",
    },
  ],
});

const rails = guideArticle("accounts", "bot-protection-rails", {
  heading: "Add human verification to a Rails form",
  title: "Add human verification to a Rails signup",
  description:
    "Add human verification to a Rails form and verify the token in the controller before you save the user.",
  ogAlt: "A Rails form embeds the widget iframe. The controller calls siteverify, then saves the user.",
  summary:
    "Keep protect_from_forgery. Embed the BotRepel iframe in the form and store the token in botrepel-response. In the controller, POST the token to /v1/siteverify with the secret from Rails credentials, and save the user only when success is true. A skipped authenticity token does not become safe because the widget was on the page.",
  sections: [
    {
      heading: "Keep the authenticity token",
      blocks: [
        p(
          "Rails checks a per-session authenticity token on POST. Leave protect_from_forgery on. BotRepel's token is a second field, checked against BotRepel, and it expires in five minutes. Removing the authenticity check because the widget seems to cover the form opens a cross-site post that can still carry a stolen or unused verification token if the attacker can obtain one.",
        ),
        p(
          "This repository does not ship a Rails gem. Use the HTTP API from the [docs](/docs#verify). Store the secret with rails credentials:edit or the platform's env, under a name you read on the server. The site key is public and can live in a credential or an ENV var that the layout prints.",
        ),
        diagram(
          "bot-protection-rails",
          "The Rails form sends the authenticity token and botrepel-response. The controller verifies the token with siteverify and saves the user only after success.",
          "The authenticity token and the BotRepel token are different fields. The controller checks both.",
        ),
      ],
    },
    {
      heading: "Form",
      blocks: [
        p(
          "form_with emits the authenticity token. Add the iframe and the hidden field beside the email input. The listener is the same pattern as the [Express guide](/articles/bot-protection-express). Put it in the asset pipeline or importmap as a small file, and do not inline the secret anywhere in that file.",
        ),
        code(
          "new.html.erb",
          `<%= form_with url: signups_path, id: "signup" do %>
  <%= label_tag :email %>
  <%= email_field_tag :email, nil, autocomplete: "email", required: true %>
  <iframe id="botrepel" title="Human verification"
    src="https://botrepel.com/w/br_pk_YOUR_SITE_KEY?origin=https%3A%2F%2Fexample.com&action=signup"
    allow="camera; publickey-credentials-get; publickey-credentials-create"
    style="width:300px;height:64px;border:0"></iframe>
  <%= hidden_field_tag "botrepel-response", "" %>
  <%= submit_tag "Create account" %>
<% end %>`,
        ),
      ],
    },
    {
      heading: "Controller",
      blocks: [
        p(
          "Net::HTTP is in the standard library. Set open and read timeouts. Parse JSON only when the status is 200, and treat a transport error as a failed verification. Pin the hostname. request.host follows the client, so it is the wrong value to send as the host you expect.",
        ),
        code(
          "signups_controller.rb",
          `require "json"
require "net/http"

class SignupsController < ApplicationController
  def create
    result = siteverify(params["botrepel-response"].to_s)
    unless result["success"] && result["action"] == "signup" && result["hostname"] == "example.com"
      render plain: "Verification failed", status: :forbidden
      return
    end
    # User.create! from params[:email], then send confirmation.
    render plain: "Account created", status: :created
  end

  private

  def siteverify(token)
    uri = URI("https://botrepel.com/v1/siteverify")
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true
    http.open_timeout = 5
    http.read_timeout = 5
    request = Net::HTTP::Post.new(uri)
    request["content-type"] = "application/json"
    request.body = JSON.generate(secret: botrepel_secret, response: token)
    JSON.parse(http.request(request).body)
  rescue StandardError
    { "success" => false, "error-codes" => ["internal-error"] }
  end

  def botrepel_secret
    ENV.fetch("BOTREPEL_SECRET_KEY")
  end
end`,
        ),
        p(
          `${TOKEN_SENTENCE} ${PRICE_SENTENCE} ${ASSURANCE_SENTENCE} Read assurance from the JSON when the action's policy needs more than the default. Do not log params["botrepel-response"] in the production log. filter_parameter_logging can append botrepel-response and BOTREPEL_SECRET_KEY so a parameter dump stays redacted.`,
        ),
      ],
    },
    {
      heading: "Devise and other engines",
      blocks: [
        p(
          "Devise registrations are a separate controller. The widget has to be on the Devise form you actually render, and the verify call has to run in that controller before super or before the resource saves. A check on SignupsController does not run for /users. The same split applies to a password-reset form: use action password-reset on both the iframe and the comparison, so a signup token cannot reset a password.",
        ),
        p(
          "Add a [rate limit](/articles/rate-limit-signup-and-login) with rack-attack in front of the create action. Throttle before the Net::HTTP call so a loop does not hold open outbound requests. If siteverify raises, the rescue above fails closed. Confirm that rescue does not also swallow a successful create. It sits only around the HTTP call in the snippet.",
        ),
      ],
    },
    {
      heading: "Turbo, CSP, and the log",
      blocks: [
        p(
          "Rails 7+ with Turbo replaces the page body without a full load. A listener registered on window once, in application.js, still receives messages. Look up the form and the iframe when the message arrives, not when the script first ran, or you will write the token into a detached node from the previous visit. If you put the listener in an inline script inside the form, Turbo may not run it again. The window listener avoids that.",
        ),
        p(
          "A Content-Security-Policy frame-src of 'self' blocks the widget. Allow https://botrepel.com. script-src still has to allow your listener. Do not weaken the policy to 'unsafe-inline' for the whole site to make one snippet work. Put the listener in the asset pipeline.",
        ),
        p(
          'config.filter_parameters should include botrepel-response. A development log that prints parameters will otherwise store a live token, and that token is a credential until it expires or is used. ENV.fetch("BOTREPEL_SECRET_KEY") raises on boot if the key is missing, which is what you want. A rescue that turns a missing key into success is the failure mode to test: unset the variable in a CI job that boots the app and expect it to refuse to start, then set it and expect a missing token to return 403.',
        ),
        p(
          "Devise maps registration and session to different controllers. Repeat the iframe with action signup on the registration form and action login on the session form. A single partial that always sends signup will make every login fail with action-mismatch, or, if you forget expectedAction, will let a signup token open a session. Set the action in the partial as an argument. The [docs](/docs) list the action strings the auth integrations use, if you later move that form to one of those libraries. After deploy, create one user through the browser and one POST with curl and no token. The curl request must get 403 and must not send mail.",
        ),
        p(
          "Net::HTTP does not raise on an HTTP 500. The snippet parses the body and then checks success. If the body is empty, JSON.parse raises and the rescue fails closed, which is what you want. If you later print the response for debugging, strip the request body first. The secret is in that body. Use a WebMock or VCR fixture in the test suite that returns success false and success true, and assert the user count. A test that stubs siteverify to always return success will stay green while the controller stops calling it. Assert that the stub was called.",
        ),
        p(
          "Strong parameters do not need to permit botrepel-response if you read it with params before you slice the user hash. If you permit it onto the User model, Rails will try to write a column you do not have. Read the token, verify, then pass only email and password into the model. Password confirmation and the other fields stay as they are. The token is not an attribute of the account. Add botrepel-response to filter_parameters in the same commit as the controller, and confirm a failed signup log line shows [FILTERED] where the token was. Check the production log format as well as a local console. A filtered local log can still print the token in production if the filter list differs. Keep that list in the same commit as the controller.",
        ),
      ],
    },
  ],
  howTo: {
    name: "Protect a Rails signup controller",
    steps: [
      {
        name: "Keep protect_from_forgery",
        text: "Leave the authenticity token on the form.",
      },
      {
        name: "Add the iframe and hidden field",
        text: "Use your public site key, the page origin, and action signup. Copy the token into botrepel-response.",
      },
      {
        name: "Call siteverify in the controller",
        text: "POST the secret and the token with a five-second timeout. Require success, action, and hostname.",
      },
      {
        name: "Save the user after success",
        text: "Create the record only when the check passes, and redact the token in logs.",
      },
    ],
  },
  faqs: [
    {
      question: "Does this repository include a Rails gem?",
      answer:
        "No. POST JSON to https://botrepel.com/v1/siteverify from the controller. The fields are secret and response.",
    },
    {
      question: "Can I drop the authenticity token if the widget is present?",
      answer: "No. Keep protect_from_forgery. The BotRepel token is checked separately and expires after five minutes.",
    },
  ],
  related: [
    "/articles/bot-protection-django",
    "/articles/stop-fake-signups",
    "/articles/rate-limit-signup-and-login",
    "/docs",
  ],
  sources: [
    { name: "BotRepel docs", href: "/docs" },
    {
      name: "Rails security guide, CSRF",
      href: "https://guides.rubyonrails.org/security.html#cross-site-request-forgery-csrf",
    },
  ],
});

const wordpress = guideArticle("accounts", "bot-protection-wordpress", {
  heading: "Add human verification to a WordPress form",
  title: "Add human verification to WordPress forms",
  description: "Add human verification to WordPress comments and registration with the widget iframe and siteverify.",
  ogAlt:
    "WordPress renders the widget iframe on a form. PHP calls siteverify with wp_remote_post before the comment or user is saved.",
  summary:
    "This product does not include a WordPress plugin. Embed the BotRepel iframe on the comment form or the registration form, and call /v1/siteverify from PHP with wp_remote_post before WordPress saves the comment or the user. Put the secret in wp-config.php. A form plugin that posts from the browser still needs the check in the server handler that writes the row.",
  sections: [
    {
      heading: "There is no plugin to install",
      blocks: [
        p(
          "The integration that exists is the widget iframe and the siteverify HTTP API, documented for [pages without React](/docs#html) and for [any language](/docs#verify). WordPress can host both: the theme or a small must-use plugin prints the iframe, and PHP posts the token to BotRepel. Do not put the secret in the theme customizer or in a post. Define it in wp-config.php, which should already be unreadable by visitors.",
        ),
        code(
          "wp-config.php",
          `define('BOTREPEL_SECRET_KEY', 'br_sk_replace_me');
define('BOTREPEL_SITE_KEY', 'br_pk_replace_me');`,
        ),
        p(
          "BOTREPEL_SITE_KEY is public. It will appear in the iframe URL. BOTREPEL_SECRET_KEY must not appear in HTML, in a JavaScript file, or in a debug display. Add the site's domain in the BotRepel dashboard, including both the apex and www if both serve the form.",
        ),
        diagram(
          "bot-protection-wordpress",
          "A WordPress form includes the iframe. PHP sends the token to siteverify with wp_remote_post. The comment or user is saved only after success.",
          "The secret stays in wp-config.php. The browser only receives the public site key inside the iframe URL.",
        ),
      ],
    },
    {
      heading: "Verify helper",
      blocks: [
        p(
          "wp_remote_post is the WordPress HTTP API. A form body is enough. BotRepel accepts that encoding. Give the request a timeout of five seconds, matching the server SDK. Tokens are br_tk_ plus letters and digits, so sanitize_text_field does not damage them. Still compare action and hostname after success.",
        ),
        code(
          "mu-plugins/botrepel.php",
          `<?php
function botrepel_verify(string $token, string $action): bool {
    if ($token === '') {
        return false;
    }
    $response = wp_remote_post('https://botrepel.com/v1/siteverify', [
        'timeout' => 5,
        'body' => [
            'secret' => BOTREPEL_SECRET_KEY,
            'response' => $token,
        ],
    ]);
    if (is_wp_error($response)) {
        return false;
    }
    $body = json_decode(wp_remote_retrieve_body($response), true);
    return is_array($body)
        && !empty($body['success'])
        && ($body['action'] ?? '') === $action
        && ($body['hostname'] ?? '') === 'example.com';
}

function botrepel_posted_token(): string {
    if (!isset($_POST['botrepel-response'])) {
        return '';
    }
    return sanitize_text_field(wp_unslash($_POST['botrepel-response']));
}`,
        ),
        p(
          `${TOKEN_SENTENCE} ${PRICE_SENTENCE} ${ASSURANCE_SENTENCE} A transport error fails closed in this helper. Registration and comments stop until BotRepel answers. That is the right default for a public form. Log the error code from the JSON when you need to debug, and leave the token out of the log.`,
        ),
      ],
    },
    {
      heading: "Comments",
      blocks: [
        p(
          "comment_form prints the core comment form. The comment_form_after_fields action is a place to add the iframe and the hidden input. preprocess_comment runs before the comment is stored. wp_die with status 403 stops the save. Use the same plain error you use elsewhere, and do not tell the commenter they were classified as a bot.",
        ),
        code(
          "mu-plugins/botrepel.php",
          `add_action('comment_form_after_fields', function () {
    $key = rawurlencode(BOTREPEL_SITE_KEY);
    $origin = rawurlencode(home_url());
    echo '<iframe id="botrepel" title="Human verification" src="https://botrepel.com/w/' . esc_attr($key) . '?origin=' . esc_attr($origin) . '&action=comment" allow="camera; publickey-credentials-get; publickey-credentials-create" style="width:300px;height:64px;border:0"></iframe>';
    echo '<input type="hidden" name="botrepel-response" value="">';
});

add_filter('preprocess_comment', function ($commentdata) {
    if (!botrepel_verify(botrepel_posted_token(), 'comment')) {
        wp_die('Verification failed', 'Verification failed', ['response' => 403]);
    }
    return $commentdata;
});`,
        ),
        p(
          "home_url() includes a scheme and a host, and sometimes a path. The iframe origin parameter has to be the page origin, such as https://example.com, not a path. If the site lives in a subdirectory, pass the origin explicitly instead of the full home URL. Enqueue the message listener from the [HTML docs](/docs#html) with wp_enqueue_script on singular pages that show the form. The listener writes the token into the hidden input. Without it, every comment fails closed, which is the signal that the script did not load.",
        ),
        p(
          "Logged-in comments use comment_form_logged_in_after, not comment_form_after_fields. Hook both if members and guests can both comment. A check on only one of those actions leaves the other path open.",
        ),
      ],
    },
    {
      heading: "Registration",
      blocks: [
        p(
          "Open registration is Settings, General, Membership. The form is wp-login.php?action=register. The register_form action prints extra fields. registration_errors can add an error and stop the user insert. Use action signup on this form so a comment token cannot create an account.",
        ),
        code(
          "mu-plugins/botrepel.php",
          `add_action('register_form', function () {
    $key = rawurlencode(BOTREPEL_SITE_KEY);
    $origin = rawurlencode('https://example.com');
    echo '<iframe id="botrepel" title="Human verification" src="https://botrepel.com/w/' . esc_attr($key) . '?origin=' . esc_attr($origin) . '&action=signup" allow="camera; publickey-credentials-get; publickey-credentials-create" style="width:300px;height:64px;border:0"></iframe>';
    echo '<input type="hidden" name="botrepel-response" value="">';
});

add_filter('registration_errors', function ($errors) {
    if (!botrepel_verify(botrepel_posted_token(), 'signup')) {
        $errors->add('botrepel', 'Verification failed');
    }
    return $errors;
});`,
        ),
        p(
          "Enqueue the listener on wp-login.php. The default login header does not load theme scripts unless you hook login_enqueue_scripts. The origin in the snippet is https://example.com. Use the origin that serves the form. home_url() can include a path, and the iframe parameter cannot.",
        ),
        p(
          "A contact-form plugin stores its own POST handler. The iframe has to sit inside the form that plugin renders, and botrepel_verify has to run in the plugin's server-side hook before it sends mail or inserts a row. A widget on the comment form does not see that plugin's request. Custom REST routes that create users need the same call. Core's /wp/v2/users create route is authenticated. A route you added is your responsibility.",
        ),
      ],
    },
    {
      heading: "What this does not cover",
      blocks: [
        ul([
          "xmlrpc.php and wp-login.php password attempts need a [rate limit](/articles/rate-limit-signup-and-login) at the server or the firewall. The comment hook does not run for those posts.",
          "A caching plugin that serves a static comment form can freeze an old iframe URL. Exclude the form page from the full-page cache, or set the iframe HTML as uncached.",
          "Light-check frames are discarded by BotRepel after the request. You do not store them in the media library. Say so in your privacy policy and link BotRepel's, as the [docs](/docs#privacy) ask.",
        ]),
        p(
          "Test as a guest: post a comment with the widget, post one with the hidden field emptied, and try to register with a comment token. The second and third must fail. The [fake signup](/articles/stop-fake-signups) guide is the checklist around those tests.",
        ),
      ],
    },
    {
      heading: "Caching, login, and the paths that skip the form",
      blocks: [
        p(
          "A full-page cache can store the comment form HTML, including an iframe URL from the moment the page was generated. That is fine if the site key and origin do not change. It is not fine if a plugin injects a nonce into the form and then serves the page to someone else. Exclude the singular post from the cache if comments are open, or accept that the form HTML is public and the check happens on POST, which must not be cached. A cached 403 or 201 on the comment POST would be a bug in the cache key. POST responses should not be stored.",
        ),
        p(
          "wp-login.php password posts do not run preprocess_comment. Brute force and stuffing against the login form need a limit at the web server. The [rate limit guide](/articles/rate-limit-signup-and-login) shows the shape of that limit. Adding the iframe to the login form is optional and separate: hook login_form, use action login, and verify in the authenticate filter before WordPress accepts the password as a session. Do that only if you are ready to support people who cannot complete the check, including administrators.",
        ),
        p(
          "Pingbacks and trackbacks arrive without your form. If you do not want them, turn them off in Discussion settings. The comment hook will not see a well-formed trackback the way it sees a guest comment, depending on the path WordPress uses. Test a trackback if you leave them on, and reject it when the token is missing. The same rule covers any custom REST route that inserts comments or users: call botrepel_verify in that callback, or close the route.",
        ),
      ],
    },
  ],
  howTo: {
    name: "Check WordPress comments and registration",
    steps: [
      {
        name: "Store the keys in wp-config.php",
        text: "Define BOTREPEL_SECRET_KEY and BOTREPEL_SITE_KEY. Add the site domain in the BotRepel dashboard.",
      },
      {
        name: "Print the iframe inside the form",
        text: "Hook comment_form_after_fields and register_form. Include the origin and the action. Load the message listener.",
      },
      {
        name: "Verify before save",
        text: "Call wp_remote_post to /v1/siteverify from preprocess_comment and registration_errors. Stop the save when success is not true.",
      },
      {
        name: "Test the closed paths",
        text: "Submit with the field removed, and submit a token from the wrong action. Both must be rejected.",
      },
    ],
  },
  faqs: [
    {
      question: "Does BotRepel publish a WordPress plugin?",
      answer: "Not in this repository. Use the iframe widget and wp_remote_post to https://botrepel.com/v1/siteverify.",
    },
    {
      question: "Will the comment check cover Contact Form 7 or another plugin?",
      answer:
        "No. Each plugin posts to its own handler. Embed the iframe in that form and call the verify helper in the handler that sends mail or writes a row.",
    },
  ],
  related: ["/articles/stop-fake-signups", "/articles/honeypot-fields", "/articles/bot-protection-express", "/docs"],
  sources: [
    { name: "BotRepel docs", href: "/docs" },
    {
      name: "WordPress HTTP API",
      href: "https://developer.wordpress.org/plugins/http-api/",
    },
    {
      name: "comment_form_after_fields",
      href: "https://developer.wordpress.org/reference/hooks/comment_form_after_fields/",
    },
  ],
});

export const OTHER_FRAMEWORK_ARTICLES: readonly Article[] = [django, rails, wordpress];
