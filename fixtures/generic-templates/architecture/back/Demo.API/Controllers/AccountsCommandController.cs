using MediatR;
using Microsoft.AspNetCore.Mvc;

namespace Demo.API.Controllers;

[Route("api/accounts")]
public class AccountsCommandController : ControllerBase
{
    private readonly IMediator _mediator;

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateAccountCommand command)
    {
        var result = await _mediator.Send(command);
        return Ok(result);
    }
}
